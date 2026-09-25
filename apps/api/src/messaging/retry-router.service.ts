import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConfirmChannel, ConsumeMessage, Options } from 'amqplib';
import type { BookingStepDispatchMessage } from '@/dispatch/dispatch.types';
import { dispatchEnvelopeSchema } from '@/messaging/dispatch-envelope.schema';
import {
  COMPLETION_ROUTING_KEYS,
  EXCHANGES,
  QUEUES,
} from '@/messaging/messaging.constants';
import type { BookingStepCompletionMessage } from '@/messaging/messaging.types';
import { getFailureCount } from '@/messaging/x-death';

const primaryRoutes = new Map<string, string>([
  [QUEUES.FLIGHT_AVAILABILITY, COMPLETION_ROUTING_KEYS.FLIGHT_AVAILABILITY],
  [QUEUES.HOTEL_AVAILABILITY, COMPLETION_ROUTING_KEYS.HOTEL_AVAILABILITY],
  [QUEUES.FRAUD, COMPLETION_ROUTING_KEYS.FRAUD],
  [QUEUES.FLIGHT_ALLOTMENT, COMPLETION_ROUTING_KEYS.FLIGHT_ALLOTMENT],
  [QUEUES.HOTEL_ALLOTMENT, COMPLETION_ROUTING_KEYS.HOTEL_ALLOTMENT],
  [QUEUES.PAYMENT, COMPLETION_ROUTING_KEYS.PAYMENT],
  [QUEUES.NOTIFY, COMPLETION_ROUTING_KEYS.NOTIFY],
]);

const ROUTER_ERROR_REQUEUE_DELAY_MS = 1000;
// Keep the queue TTL finite if a reloaded graph config specifies a huge backoff.
const MAX_RETRY_QUEUE_TTL_MS = 2_147_483_647;

@Injectable()
export class RetryRouterService {
  private readonly logger = new Logger(RetryRouterService.name);
  private readonly exchange: string;

  constructor(configService: ConfigService) {
    this.exchange = configService.get<string>(
      'RABBITMQ_EXCHANGE',
      EXCHANGES.BOOKING_TOPIC,
    );
  }

  async handle(
    message: ConsumeMessage,
    channel: ConfirmChannel,
  ): Promise<void> {
    try {
      await this.route(message, channel);
      channel.ack(message);
    } catch (err) {
      this.logger.error(
        `Failed to route rejected message with routingKey=${message.fields.routingKey}`,
        err instanceof Error ? err.stack : String(err),
      );
      await new Promise<void>((resolve) =>
        setTimeout(resolve, ROUTER_ERROR_REQUEUE_DELAY_MS),
      );
      try {
        channel.nack(message, false, true);
      } catch {
        // A closed channel will redeliver its unacknowledged message.
      }
    }
  }

  private async route(
    message: ConsumeMessage,
    channel: ConfirmChannel,
  ): Promise<void> {
    const queue = message.fields.routingKey;
    const completionKey = primaryRoutes.get(queue);
    if (!completionKey) {
      await this.archive(message, channel);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(message.content.toString());
    } catch {
      parsed = null;
    }
    const envelope = dispatchEnvelopeSchema.safeParse(parsed);
    if (!envelope.success || envelope.data.pattern !== queue) {
      this.logger.warn(
        `Invalid retry message for queue=${queue}; moving to DLQ`,
      );
      await this.archive(message, channel);
      return;
    }

    const data = envelope.data.data;
    const failureCount = getFailureCount(message, queue);
    if (failureCount === 0) {
      this.logger.warn(
        `Missing rejection history for queue=${queue}; moving to DLQ`,
      );
      await this.archive(message, channel);
      return;
    }

    const delayMs = this.getExponentialBackoffMs(data.retry, failureCount);
    if (delayMs !== null) {
      const delayQueue = `${queue}.retry.${delayMs}`;
      await channel.assertQueue(delayQueue, {
        durable: true,
        arguments: {
          'x-message-ttl': delayMs,
          'x-dead-letter-exchange': this.exchange,
          'x-dead-letter-routing-key': queue,
        },
      });
      await this.sendToQueue(
        channel,
        delayQueue,
        message.content,
        this.copyOptions(message),
      );
      this.logger.warn(
        `Scheduled retry ${failureCount}/${data.retry.max} for stepId=${data.stepId} in ${delayMs}ms`,
      );
      return;
    }

    const completion: BookingStepCompletionMessage = {
      stepId: data.stepId,
      bookingId: data.bookingId,
      stepName: data.stepName,
      scope: data.scope,
      agent: data.agent,
      flightBookingId: data.flightBookingId,
      hotelBookingId: data.hotelBookingId,
      attempt: data.attempt,
      status: 'failed',
      error: {
        code: 'RETRY_EXHAUSTED',
        message: `Processing failed after ${failureCount} ${failureCount === 1 ? 'attempt' : 'attempts'}`,
        retryable: false,
      },
    };
    await this.publish(
      channel,
      this.exchange,
      completionKey,
      Buffer.from(JSON.stringify({ pattern: completionKey, data: completion })),
      { persistent: true, contentType: 'application/json' },
    );
    await this.archive(message, channel);
    this.logger.error(
      `Retries exhausted for stepId=${data.stepId} after ${failureCount} ${failureCount === 1 ? 'attempt' : 'attempts'}`,
    );
  }

  private async archive(
    message: ConsumeMessage,
    channel: ConfirmChannel,
  ): Promise<void> {
    await channel.assertQueue(QUEUES.DLQ, { durable: true });
    await this.sendToQueue(
      channel,
      QUEUES.DLQ,
      message.content,
      this.copyOptions(message),
    );
  }

  private publish(
    channel: ConfirmChannel,
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: Options.Publish,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      channel.publish(exchange, routingKey, content, options, (err) => {
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else resolve();
      });
    });
  }

  private sendToQueue(
    channel: ConfirmChannel,
    queue: string,
    content: Buffer,
    options: Options.Publish,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      channel.sendToQueue(queue, content, options, (err) => {
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else resolve();
      });
    });
  }

  private getExponentialBackoffMs(
    retry: BookingStepDispatchMessage['retry'],
    failureCount: number,
  ): number | null {
    if (failureCount > retry.max) return null;

    return Math.min(
      retry.backoffMs * 2 ** (failureCount - 1),
      MAX_RETRY_QUEUE_TTL_MS,
    );
  }

  private copyOptions(message: ConsumeMessage): Options.Publish {
    return {
      persistent: true,
      contentType: 'application/json',
      // RabbitMQ 3.13 keeps this death history across the retry republish.
      headers: message.properties.headers,
    };
  }
}
