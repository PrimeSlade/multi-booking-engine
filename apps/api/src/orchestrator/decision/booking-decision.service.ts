import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingDecision } from '@/orchestrator/decision/dto/booking-decision.dto';
import { StageAdvancementService } from '@/orchestrator/advancement/stage-advancement.service';
import { SagaCompensationService } from '@/orchestrator/compensation/saga-compensation.service';

type DecisionFailureCode =
  'PARTIAL_BOOKING_REJECTED' | 'PARTIAL_DECISION_TIMEOUT';

@Injectable()
export class BookingDecisionService {
  private readonly logger = new Logger(BookingDecisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stageAdvancementService: StageAdvancementService,
    private readonly compensationService: SagaCompensationService,
  ) {}

  async decide(bookingId: string, decision: BookingDecision) {
    const booking = await this.prisma.db.orm.public.Booking.where({
      id: bookingId,
    })
      .all()
      .first();
    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }
    if (booking.status !== 'awaiting_user_decision') {
      throw new ConflictException(
        `Booking ${bookingId} is not awaiting a decision`,
      );
    }
    if (
      booking.decisionExpiresAt &&
      new Date(booking.decisionExpiresAt).getTime() <= Date.now()
    ) {
      await this.rejectAwaitingBooking(bookingId, 'PARTIAL_DECISION_TIMEOUT');
      throw new ConflictException(`Decision window expired for ${bookingId}`);
    }

    if (decision === 'reject_all') {
      const rejected = await this.rejectAwaitingBooking(
        bookingId,
        'PARTIAL_BOOKING_REJECTED',
      );
      if (!rejected) this.throwDecisionConflict(bookingId);
      return rejected;
    }

    const accepted = await this.prisma.db.orm.public.Booking.where({
      id: bookingId,
      status: 'awaiting_user_decision',
    }).update({ status: 'in_progress', decisionExpiresAt: null });
    if (!accepted) this.throwDecisionConflict(bookingId);

    await this.stageAdvancementService.resumeAfterDecision(bookingId);
    this.logger.log(`Booking ${bookingId} accepted successful allotments`);
    return accepted;
  }

  async expireDueDecisions(): Promise<number> {
    const awaiting = await this.prisma.db.orm.public.Booking.where({
      status: 'awaiting_user_decision',
    })
      .all()
      .toArray();
    const now = Date.now();
    const expired = awaiting.filter(
      (booking: { decisionExpiresAt: string | null }) =>
        booking.decisionExpiresAt !== null &&
        new Date(booking.decisionExpiresAt).getTime() <= now,
    );

    const results: PromiseSettledResult<unknown>[] = await Promise.allSettled(
      expired.map((booking: { id: string }) =>
        this.rejectAwaitingBooking(booking.id, 'PARTIAL_DECISION_TIMEOUT'),
      ),
    );
    results.forEach((result: PromiseSettledResult<unknown>, index: number) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to expire booking ${expired[index].id}`,
          result.reason instanceof Error
            ? result.reason.stack
            : String(result.reason),
        );
      }
    });
    return results.filter(
      (result: PromiseSettledResult<unknown>) =>
        result.status === 'fulfilled' && result.value !== null,
    ).length;
  }

  private async rejectAwaitingBooking(
    bookingId: string,
    code: DecisionFailureCode,
  ) {
    const rejected = await this.prisma.db.orm.public.Booking.where({
      id: bookingId,
      status: 'awaiting_user_decision',
    }).update({ status: 'failed', decisionExpiresAt: null });
    if (!rejected) return null;

    await this.prisma.db.orm.public.BookingStep.where({
      bookingId,
      status: 'pending',
    }).updateAll({
      status: 'failed',
      error: { code, retryable: false },
    });

    await this.compensationService.compensateSuccessfulSteps(bookingId);
    this.logger.warn(`Booking ${bookingId} rejected with code=${code}`);
    return rejected;
  }

  private throwDecisionConflict(bookingId: string): never {
    throw new ConflictException(
      `Booking ${bookingId} decision was already resolved`,
    );
  }
}
