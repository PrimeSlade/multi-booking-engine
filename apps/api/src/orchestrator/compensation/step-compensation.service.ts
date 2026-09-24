import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BookingStepCompensatedMessage } from '@/messaging/messaging.types';

@Injectable()
export class StepCompensationService {
  private readonly logger = new Logger(StepCompensationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async applyCompensated(message: BookingStepCompensatedMessage) {
    const updated = await this.prisma.db.orm.public.BookingStep.where({
      id: message.stepId,
      status: 'compensating',
    }).update({ status: 'compensated' });

    if (updated === null) {
      this.logger.warn(
        `No 'compensating' BookingStep row found for stepId=${message.stepId} (bookingId=${message.bookingId})`,
      );
    }

    return updated;
  }
}
