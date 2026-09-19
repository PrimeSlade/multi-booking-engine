import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingStepCompletionMessage } from '@/messaging/messaging.types';

@Injectable()
export class StepCompletionService {
  private readonly logger = new Logger(StepCompletionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async applyCompletion(message: BookingStepCompletionMessage): Promise<void> {
    // .update() is the single-row verb here: returns the updated row, or
    // null if nothing matched (updateAll()/updateAndCount() are the
    // bulk/streaming/count-only forms - not what we want for a lookup by id).
    //
    // Not handled yet: this doesn't check message.attempt against the row's
    // current attempt, so a stale completion from an earlier attempt could
    // clobber a newer one if it arrives late. Not reachable today (every
    // step is attempt: 0, no retries exist yet) - worth revisiting once
    // retries land.
    const updated = await this.prisma.db.orm.public.BookingStep.where({
      id: message.stepId,
    }).update({
      status: message.status,
      result: message.result ?? null,
      error: message.error ?? null,
      retryable: message.error?.retryable ?? null,
    });

    if (updated === null) {
      this.logger.warn(
        `No BookingStep row found for stepId=${message.stepId} (bookingId=${message.bookingId})`,
      );
    }
  }
}
