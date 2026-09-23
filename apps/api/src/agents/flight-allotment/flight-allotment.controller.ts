import { Controller, Inject, Logger } from '@nestjs/common';
import {
  ClientProxy,
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import { BOOKING_RMQ_CLIENT, QUEUES } from '@/messaging/messaging.constants';
import {
  BookingStepCompensatedMessage,
  BookingStepCompletionMessage,
} from '@/messaging/messaging.types';
import {
  BookingStepCompensateMessage,
  BookingStepDispatchMessage,
} from '@/dispatch/dispatch.types';
import { firstValueFrom } from 'rxjs';
import { FlightAllotmentService } from '@/agents/flight-allotment/flight-allotment.service';

@Controller()
export class FlightAllotmentController {
  private readonly logger = new Logger(FlightAllotmentController.name);

  constructor(
    @Inject(BOOKING_RMQ_CLIENT) private readonly client: ClientProxy,
    private readonly allotmentService: FlightAllotmentService,
  ) {}

  @EventPattern(QUEUES.FLIGHT_ALLOTMENT)
  async handle(
    @Payload() data: BookingStepDispatchMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    let completion: BookingStepCompletionMessage;
    try {
      const outcome = await this.allotmentService.reserveSeat(
        data.flightBookingId,
      );

      completion = outcome.reserved
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
            error: { code: 'SEAT_UNAVAILABLE', retryable: false },
          };

      // Business outcome resolved either way (reserved or not) - the
      // message was handled correctly, so it's acked regardless of outcome.
      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error(
        `flight.allotment check failed for stepId=${data.stepId}`,
        err instanceof Error ? err.stack : String(err),
      );
      // Processing itself broke (not a business outcome) - log and drop.
      // No DLQ consumer exists yet, so requeueing would just loop forever.
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

  @EventPattern(QUEUES.FLIGHT_ALLOTMENT_COMPENSATE)
  async handleCompensate(
    @Payload() data: BookingStepCompensateMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    try {
      await this.allotmentService.releaseSeat(data.flightBookingId);
      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error(
        `flight.allotment compensation failed for stepId=${data.stepId}`,
        err instanceof Error ? err.stack : String(err),
      );
      // No DLQ consumer exists yet, so requeueing would just loop forever.
      channel.nack(originalMsg, false, false);
      return;
    }

    const message: BookingStepCompensatedMessage = {
      stepId: data.stepId,
      bookingId: data.bookingId,
      stepName: data.stepName,
    };

    try {
      await firstValueFrom(
        this.client.emit(`booking.step.compensated.${data.stepName}`, message),
      );
    } catch (err) {
      this.logger.error(
        `Failed to publish compensated event for stepId=${data.stepId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
