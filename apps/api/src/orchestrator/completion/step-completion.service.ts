import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingStepCompletionMessage } from '@/messaging/messaging.types';

@Injectable()
export class StepCompletionService {
  private readonly logger = new Logger(StepCompletionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Returns the updated row (or null) rather than void so callers - namely
  // StageAdvancementService - can read .stage/.status/.bookingId off it
  // without an extra query.
  async applyCompletion(message: BookingStepCompletionMessage) {
    // .update() is the single-row verb here: returns the updated row, or
    // null if nothing matched (updateAll()/updateAndCount() are the
    // bulk/streaming/count-only forms - not what we want for a lookup by id).
    //
    // A completion can be redelivered after a publish/ack failure. Only the
    // active attempt may settle the step and advance its stage.
    const updated = await this.prisma.db.orm.public.BookingStep.where({
      id: message.stepId,
      status: 'in_progress',
      attempt: message.attempt,
    }).update({
      status: message.status,
      result: message.result ?? null,
      error: message.error ?? null,
      retryable: message.error?.retryable ?? null,
    });

    if (updated === null) {
      this.logger.warn(
        `No active BookingStep row found for stepId=${message.stepId} (bookingId=${message.bookingId}, attempt=${message.attempt})`,
      );
    }

    return updated;
  }
}
