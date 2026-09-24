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
    const stageSteps = await this.prisma.db.orm.public.BookingStep.where({
      bookingId: step.bookingId,
      stage: step.stage,
    })
      .all()
      .toArray();

    // Fail-fast: cancel on the first failed step in the stage, regardless of
    // whether it was this completion or an already-reported sibling. Not
    // waiting for every sibling to report is the join/all_or_ask policy's
    // job (deferred - see TASKS.md); this only covers "nothing was
    // committed yet, so there's nothing to compensate."
    if (stageSteps.some((s: { status: string }) => s.status === 'failed')) {
      await this.cancelBooking(step.bookingId, step.stage);
      return;
    }

    const allSuccess = stageSteps.every(
      (s: { status: string }) => s.status === 'success',
    );
    if (!allSuccess) return; // still waiting on siblings

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
      const confirmed = await this.prisma.db.orm.public.Booking.where({
        id: step.bookingId,
        status: 'in_progress',
      }).update({ status: 'confirmed' });
      if (confirmed) {
        this.logger.log(
          `Booking ${step.bookingId} confirmed after final stage ${step.stage}`,
        );
      }
      return;
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

  private async cancelBooking(bookingId: string, stage: number): Promise<void> {
    // Conditional claim, same idiom as the stage-dispatch claim above: if
    // multiple failures race (or a later stage's own step also fails),
    // only the first one to see status still 'in_progress' does the work.
    const bookingUpdated = await this.prisma.db.orm.public.Booking.where({
      id: bookingId,
      status: 'in_progress',
    }).update({ status: 'failed' });

    if (bookingUpdated === null) return; // already cancelled

    await this.prisma.db.orm.public.BookingStep.where({
      bookingId,
      status: 'pending',
    }).updateAll({
      status: 'failed',
      error: { code: 'BOOKING_CANCELLED', retryable: false },
    });

    this.logger.warn(`Booking ${bookingId} cancelled: stage ${stage} failed`);

    await this.compensateSuccessfulSteps(bookingId);
  }

  private async compensateSuccessfulSteps(bookingId: string): Promise<void> {
    const [flightBookings, hotelBookings] = await Promise.all([
      this.prisma.db.orm.public.FlightBooking.where({ bookingId })
        .all()
        .toArray(),
      this.prisma.db.orm.public.HotelBooking.where({ bookingId })
        .all()
        .toArray(),
    ]);
    const products = [
      ...(flightBookings.length ? ['flight'] : []),
      ...(hotelBookings.length ? ['hotel'] : []),
    ];
    const graph = this.graphService.generate({ products });

    // Generic on purpose: any success step whose graph entry declares a
    // compensate action gets claimed and dispatched, not just
    // flight.allotment. Known gap: hotel.allotment declares one but has no
    // consumer yet, so a step there would get stuck at 'compensating'
    // forever. Not reachable today; accepted until the hotel agent grows a
    // compensate handler too.
    const compensatable = new Set(
      graph.steps.filter((s) => s.compensate).map((s) => s.stepName),
    );
    if (compensatable.size === 0) return;

    const successSteps = await this.prisma.db.orm.public.BookingStep.where({
      bookingId,
      status: 'success',
    })
      .all()
      .toArray();
    const eligible = successSteps.filter((s: BookingStepRow) =>
      compensatable.has(s.stepName),
    );
    if (eligible.length === 0) return;

    // Per-row conditional claim (no bulk "id IN [...]" filter verified to
    // exist on this ORM target - each claim targets a distinct id anyway, so
    // a loop of single-row conditional updates is both simpler and provably
    // supported, same idiom as applyCompletion's single-row claim).
    const claims = await Promise.all(
      eligible.map(async (row: BookingStepRow) => {
        const updated = await this.prisma.db.orm.public.BookingStep.where({
          id: row.id,
          status: 'success',
        }).update({ status: 'compensating' });
        return updated ? row : null;
      }),
    );
    const claimed = claims.filter(
      (r: BookingStepRow | null): r is BookingStepRow => r !== null,
    );
    if (claimed.length === 0) return;

    await this.dispatchService.dispatchCompensations(claimed);
  }
}
