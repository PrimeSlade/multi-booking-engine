import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GraphService } from '@/graph/graph.service';
import {
  BookingStepRow,
  StepDispatchService,
} from '@/dispatch/step-dispatch.service';
import { StepCompletionService } from '@/orchestrator/step-completion.service';

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
  ) {}

  async maybeAdvance(step: CompletedStep): Promise<void> {
    if (step.status !== 'success') return; // failure/join handling deferred

    const stageSteps = await this.prisma.db.orm.public.BookingStep.where({
      bookingId: step.bookingId,
      stage: step.stage,
    })
      .all()
      .toArray();

    const allSuccess = stageSteps.every(
      (s: { status: string }) => s.status === 'success',
    );
    if (!allSuccess) {
      if (stageSteps.some((s: { status: string }) => s.status === 'failed')) {
        this.logger.warn(
          `Stage ${step.stage} for booking ${step.bookingId} has a failed step; not advancing (partial-failure/join handling not implemented yet)`,
        );
      }
      return; // still waiting on siblings, or blocked on a failure
    }

    const [flightBookings, hotelBookings] = await Promise.all([
      this.prisma.db.orm.public.FlightBooking.where({
        bookingId: step.bookingId,
      })
        .all()
        .toArray(),
      this.prisma.db.orm.public.HotelBooking.where({
        bookingId: step.bookingId,
      })
        .all()
        .toArray(),
    ]);
    const products = [
      ...(flightBookings.length ? ['flight'] : []),
      ...(hotelBookings.length ? ['hotel'] : []),
    ];
    const graph = this.graphService.generate({ products });

    // Array-index traversal, not `stage + 1`: graph.stages omits any stage
    // with zero steps for this booking's product mix, so stage numbers
    // aren't guaranteed contiguous in general.
    const currentIndex = graph.stages.findIndex((s) => s.stage === step.stage);
    const nextStageDef = graph.stages[currentIndex + 1];
    if (!nextStageDef) {
      this.logger.log(
        `Booking ${step.bookingId} completed its final stage (${step.stage})`,
      );
      return; // marking Booking.status confirmed is a later increment
    }

    // Conditional bulk update doubles as a claim: if two sibling completions
    // in this stage both see "all success" and race to advance, only one
    // transaction's WHERE still matches once the other has committed - same
    // "conditional update as ownership check" idiom applyCompletion already
    // uses at single-row scope, applied here at bulk scope.
    const claimed = await this.prisma.db.orm.public.BookingStep.where({
      bookingId: step.bookingId,
      stage: nextStageDef.stage,
      status: 'pending',
    }).updateAll({ status: 'in_progress' });

    if (claimed.length === 0) return; // another completion already claimed it

    const pairs = claimed.map((row: BookingStepRow) => {
      const generated = nextStageDef.steps.find(
        (g) => g.stepName === row.stepName,
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
}
