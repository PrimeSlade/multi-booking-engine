import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GraphService } from '@/graph/graph.service';
import {
  BookingStepRow,
  StepDispatchService,
} from '@/dispatch/step-dispatch.service';
import { StepCompletionService } from '@/orchestrator/completion/step-completion.service';
import { SagaCompensationService } from '@/orchestrator/compensation/saga-compensation.service';
import { GeneratedGraph } from '@/graph';

type CompletedStep = NonNullable<
  Awaited<ReturnType<StepCompletionService['applyCompletion']>>
>;

@Injectable()
export class StageAdvancementService {
  private readonly logger = new Logger(StageAdvancementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphService: GraphService,
    private readonly dispatchService: StepDispatchService,
    private readonly compensationService: SagaCompensationService,
  ) {}

  async maybeAdvance(step: CompletedStep): Promise<void> {
    const stageSteps = await this.prisma.db.orm.public.BookingStep.where({
      bookingId: step.bookingId,
      stage: step.stage,
    })
      .all()
      .toArray();

    const graph = await this.generateGraph(step.bookingId);
    const currentStage = graph.stages.find(
      (stage) => stage.stage === step.stage,
    );
    const hasSuccess = stageSteps.some(
      (stageStep: { status: string }) => stageStep.status === 'success',
    );
    const hasFailure = stageSteps.some(
      (stageStep: { status: string }) => stageStep.status === 'failed',
    );

    if (currentStage?.join === 'all_or_ask' && hasFailure) {
      const allSettled = stageSteps.every((stageStep: { status: string }) =>
        ['success', 'failed'].includes(stageStep.status),
      );
      if (!allSettled) return;

      if (hasSuccess) {
        await this.pauseForDecision(step.bookingId, graph.decisionTtlMs);
      } else {
        await this.cancelBooking(step.bookingId, step.stage);
      }
      return;
    }

    if (hasFailure) {
      await this.cancelBooking(step.bookingId, step.stage);
      return;
    }

    const allSuccess = stageSteps.every(
      (stageStep: { status: string }) => stageStep.status === 'success',
    );
    if (!allSuccess) return;

    await this.advanceFromStage(step.bookingId, step.stage, graph);
  }

  async resumeAfterDecision(bookingId: string): Promise<void> {
    const graph = await this.generateGraph(bookingId);
    const decisionStage = graph.stages.find(
      (stage) => stage.join === 'all_or_ask',
    );
    if (!decisionStage) {
      throw new Error(`No all_or_ask stage found for bookingId=${bookingId}`);
    }
    await this.advanceFromStage(bookingId, decisionStage.stage, graph);
  }

  private async advanceFromStage(
    bookingId: string,
    stage: number,
    graph: GeneratedGraph,
  ): Promise<void> {
    // Array-index traversal, not `stage + 1`: graph.stages omits any stage
    // with zero steps for this booking's product mix, so stage numbers
    // aren't guaranteed contiguous in general.
    const currentIndex = graph.stages.findIndex((item) => item.stage === stage);
    const nextStageDef = graph.stages[currentIndex + 1];
    if (!nextStageDef) {
      await this.finalizeBooking(bookingId, graph, stage);
      return;
    }

    // Conditional bulk update doubles as a claim: if two sibling completions
    // in this stage both see "all success" and race to advance, only one
    // transaction's WHERE still matches once the other has committed - same
    // "conditional update as ownership check" idiom applyCompletion already
    // uses at single-row scope, applied here at bulk scope.
    const claimed = await this.prisma.db.orm.public.BookingStep.where({
      bookingId,
      stage: nextStageDef.stage,
      status: 'pending',
    }).updateAll({ status: 'in_progress' });

    if (claimed.length === 0) return;

    const pairs = claimed.map((row: BookingStepRow) => {
      const generated = nextStageDef.steps.find(
        (graphStep) => graphStep.stepName === row.stepName,
      );
      if (!generated) {
        throw new Error(
          `No graph step definition for stepName=${row.stepName} at stage=${nextStageDef.stage}`,
        );
      }
      return { step: row, generated };
    });

    await this.dispatchService.dispatchSteps(pairs);
  }

  private async pauseForDecision(
    bookingId: string,
    decisionTtlMs: number,
  ): Promise<void> {
    const decisionExpiresAt = new Date(
      Date.now() + decisionTtlMs,
    ).toISOString();
    const updated = await this.prisma.db.orm.public.Booking.where({
      id: bookingId,
      status: 'in_progress',
    }).update({
      status: 'awaiting_user_decision',
      decisionExpiresAt,
    });
    if (updated) {
      this.logger.warn(
        `Booking ${bookingId} awaiting partial-booking decision until ${decisionExpiresAt}`,
      );
    }
  }

  private async finalizeBooking(
    bookingId: string,
    graph: GeneratedGraph,
    finalStage: number,
  ): Promise<void> {
    const decisionStage = graph.stages.find(
      (stage) => stage.join === 'all_or_ask',
    );
    let status: 'confirmed' | 'partially_confirmed' = 'confirmed';
    if (decisionStage) {
      const decisionSteps = await this.prisma.db.orm.public.BookingStep.where({
        bookingId,
        stage: decisionStage.stage,
      })
        .all()
        .toArray();
      const hasSuccess = decisionSteps.some(
        (step: { status: string }) => step.status === 'success',
      );
      const hasFailure = decisionSteps.some(
        (step: { status: string }) => step.status === 'failed',
      );
      if (hasSuccess && hasFailure) status = 'partially_confirmed';
    }

    const finalized = await this.prisma.db.orm.public.Booking.where({
      id: bookingId,
      status: 'in_progress',
    }).update({ status });
    if (finalized) {
      this.logger.log(
        `Booking ${bookingId} finalized as ${status} after stage ${finalStage}`,
      );
    }
  }

  private async generateGraph(bookingId: string): Promise<GeneratedGraph> {
    const [flightBookings, hotelBookings] = await Promise.all([
      this.prisma.db.orm.public.FlightBooking.where({ bookingId })
        .all()
        .toArray(),
      this.prisma.db.orm.public.HotelBooking.where({ bookingId })
        .all()
        .toArray(),
    ]);
    return this.graphService.generate({
      products: [
        ...(flightBookings.length ? ['flight'] : []),
        ...(hotelBookings.length ? ['hotel'] : []),
      ],
    });
  }

  private async cancelBooking(bookingId: string, stage: number): Promise<void> {
    // Conditional claim, same idiom as the stage-dispatch claim above: if
    // multiple failures race (or a later stage's own step also fails),
    // only the first one to see status still 'in_progress' does the work.
    const bookingUpdated = await this.prisma.db.orm.public.Booking.where({
      id: bookingId,
      status: 'in_progress',
    }).update({ status: 'failed' });

    if (bookingUpdated === null) return;

    await this.prisma.db.orm.public.BookingStep.where({
      bookingId,
      status: 'pending',
    }).updateAll({
      status: 'failed',
      error: { code: 'BOOKING_CANCELLED', retryable: false },
    });

    this.logger.warn(`Booking ${bookingId} cancelled: stage ${stage} failed`);

    await this.compensationService.compensateSuccessfulSteps(bookingId);
  }
}
