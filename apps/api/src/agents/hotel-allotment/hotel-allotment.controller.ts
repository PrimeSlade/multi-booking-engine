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
import { HotelAllotmentService } from '@/agents/hotel-allotment/hotel-allotment.service';
import {
  BookingStepCompensateMessage,
  BookingStepDispatchMessage,
} from '@/dispatch/dispatch.types';
import { BOOKING_RMQ_CLIENT, QUEUES } from '@/messaging/messaging.constants';
import {
  BookingStepCompensatedMessage,
  BookingStepCompletionMessage,
} from '@/messaging/messaging.types';

@Controller()
export class HotelAllotmentController {
  private readonly logger = new Logger(HotelAllotmentController.name);

  constructor(
    @Inject(BOOKING_RMQ_CLIENT) private readonly client: ClientProxy,
    private readonly allotmentService: HotelAllotmentService,
  ) {}

  @EventPattern(QUEUES.HOTEL_ALLOTMENT)
  async handle(
    @Payload() data: BookingStepDispatchMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    let completion: BookingStepCompletionMessage;
    try {
      const outcome = await this.allotmentService.reserveRoom(
        data.hotelBookingId,
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
            result: { roomsLeft: outcome.roomsLeft },
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
            error: { code: 'ROOM_UNAVAILABLE', retryable: false },
          };
      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error(
        `hotel.allotment failed for stepId=${data.stepId}`,
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

  @EventPattern(QUEUES.HOTEL_ALLOTMENT_COMPENSATE)
  async handleCompensate(
    @Payload() data: BookingStepCompensateMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    try {
      await this.allotmentService.releaseRoom(data.hotelBookingId);
      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error(
        `hotel.allotment compensation failed for stepId=${data.stepId}`,
        err instanceof Error ? err.stack : String(err),
      );
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
