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
import { BOOKING_RMQ_CLIENT, QUEUES } from '@/messaging/messaging.constants';
import { BookingStepCompletionMessage } from '@/messaging/messaging.types';
import { BookingStepDispatchMessage } from '@/dispatch/dispatch.types';
import { FlightAvailabilityService } from '@/agents/flight-availability/flight-availability.service';

@Controller()
export class FlightAvailabilityController {
  private readonly logger = new Logger(FlightAvailabilityController.name);

  constructor(
    @Inject(BOOKING_RMQ_CLIENT) private readonly client: ClientProxy,
    private readonly availabilityService: FlightAvailabilityService,
  ) {}

  @EventPattern(QUEUES.FLIGHT_AVAILABILITY)
  async handle(
    @Payload() data: BookingStepDispatchMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    let completion: BookingStepCompletionMessage;
    try {
      const outcome = await this.availabilityService.checkAvailability(
        data.flightBookingId,
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
            result: { seatsLeft: outcome.seatsLeft },
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

      // Business outcome resolved either way (available or not) - the
      // message was handled correctly, so it's acked regardless of outcome.
      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error(
        `flight.availability check failed for stepId=${data.stepId}`,
        err instanceof Error ? err.stack : String(err),
      );
      // RabbitMQ records this rejection in x-death and routes it to retry.
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
