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
import {
  BookingStepCompensatedMessage,
  BookingStepCompletionMessage,
} from '@/messaging/messaging.types';
import {
  BookingStepCompensateMessage,
  BookingStepDispatchMessage,
} from '@/dispatch/dispatch.types';
import { PaymentService } from '@/agents/payment/payment.service';

@Controller()
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    @Inject(BOOKING_RMQ_CLIENT) private readonly client: ClientProxy,
    private readonly paymentService: PaymentService,
  ) {}

  @EventPattern(QUEUES.PAYMENT)
  async handle(
    @Payload() data: BookingStepDispatchMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    let completion: BookingStepCompletionMessage;
    try {
      const declined = await this.paymentService.processPayment(data.bookingId);

      completion = declined
        ? {
            stepId: data.stepId,
            bookingId: data.bookingId,
            stepName: data.stepName,
            scope: data.scope,
            agent: data.agent,
            flightBookingId: data.flightBookingId,
            hotelBookingId: data.hotelBookingId,
            attempt: data.attempt,
            status: 'failed',
            error: { code: 'PAYMENT_DECLINED', retryable: false },
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
            status: 'success',
            result: null,
            error: null,
          };

      // Business outcome resolved either way (declined or not) - the
      // message was handled correctly, so it's acked regardless of outcome.
      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error(
        `itinerary.payment check failed for stepId=${data.stepId}`,
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

  @EventPattern(QUEUES.PAYMENT_COMPENSATE)
  async handleCompensate(
    @Payload() data: BookingStepCompensateMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    // Payment is simulated, so there is no external charge to reverse.
    channel.ack(originalMsg);

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
