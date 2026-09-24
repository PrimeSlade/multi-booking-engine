import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);

  sendNotification(bookingId: string): Promise<{ notified: true }> {
    this.logger.log(`Simulated notification sent for booking ${bookingId}`);
    return Promise.resolve({ notified: true });
  }
}
