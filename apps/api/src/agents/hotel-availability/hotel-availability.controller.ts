import { Controller, Inject, Logger } from '@nestjs/common';
import {
  ClientProxy,
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import { firstValueFrom } from 'rxjs';
import { HotelAvailabilityService } from '@/agents/hotel-availability/hotel-availability.service';
import { BookingStepDispatchMessage } from '@/dispatch/dispatch.types';
import { BOOKING_RMQ_CLIENT, QUEUES } from '@/messaging/messaging.constants';
import { BookingStepCompletionMessage } from '@/messaging/messaging.types';

@Controller()
export class HotelAvailabilityController {
  private readonly logger = new Logger(HotelAvailabilityController.name);

  constructor(
    @Inject(BOOKING_RMQ_CLIENT) private readonly client: ClientProxy,
    private readonly availabilityService: HotelAvailabilityService,
  ) {}

  @EventPattern(QUEUES.HOTEL_AVAILABILITY)
  async handle(
    @Payload() data: BookingStepDispatchMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    let completion: BookingStepCompletionMessage;
    try {
      const outcome = await this.availabilityService.checkAvailability(
        data.hotelBookingId,
      );

      completion = outcome.available
        ? {
            stepId: data.stepId,
            bookingId: data.bookingId,
            stepName: data.stepName,
            scope: data.scope,
            agent: data.agent,
            flightBookingId: data.flightBookingId,
            hotelBookingId: data.hotelBookingId,
            attempt: data.attempt,
            status: 'success',
            result: {
              roomId: outcome.roomId,
              roomType: outcome.roomType,
            },
            error: null,
          }
        : {
            stepId: data.stepId,
            bookingId: data.bookingId,
            stepName: data.stepName,
            scope: data.scope,
            agent: data.agent,
            flightBookingId: data.flightBookingId,
            hotelBookingId: data.hotelBookingId,
            attempt: data.attempt,
            status: 'failed',
            error: { code: 'NO_AVAILABILITY', retryable: false },
          };

      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error(
        `hotel.availability check failed for stepId=${data.stepId}`,
        err instanceof Error ? err.stack : String(err),
      );
      channel.nack(originalMsg, false, false);
      return;
    }

    try {
      await firstValueFrom(
        this.client.emit(`booking.step.completed.${data.stepName}`, completion),
      );
    } catch (err) {
      this.logger.error(
        `Failed to publish completion for stepId=${data.stepId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
