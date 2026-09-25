jest.mock('@nestjs/config', () => ({
  ConfigService: class MockConfigService {},
}));

import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { RetryRouterService } from './retry-router.service';
import { QUEUES } from './messaging.constants';

describe('RetryRouterService', () => {
  const queue = QUEUES.NOTIFY;
  const dispatch = {
    stepId: 'step-1',
    bookingId: 'booking-1',
    stepName: 'itinerary.notify',
    scope: 'itinerary',
    agent: 'notify-agent',
    flightBookingId: null,
    hotelBookingId: null,
    attempt: 0,
    timeoutMs: 3000,
    retry: { max: 2, backoffMs: 1000 },
  };

  const message = (failureCount: number, retry = dispatch.retry) =>
    ({
      fields: { routingKey: queue },
      properties: {
        headers: {
          'x-death': [{ queue, reason: 'rejected', count: failureCount }],
        },
      },
      content: Buffer.from(
        JSON.stringify({ pattern: queue, data: { ...dispatch, retry } }),
      ),
    }) as ConsumeMessage;

  const setup = () => {
    const channel = {
      assertQueue: jest.fn().mockResolvedValue({}),
      sendToQueue: jest.fn(
        (
          _queue,
          _content,
          _options,
          confirm: (error: Error | null) => void,
        ) => {
          confirm(null);
          return true;
        },
      ),
      publish: jest.fn(
        (
          _exchange,
          _routingKey,
          _content,
          _options,
          confirm: (error: Error | null) => void,
        ) => {
          confirm(null);
          return true;
        },
      ),
      ack: jest.fn(),
      nack: jest.fn(),
    };
    const service = new RetryRouterService({
      get: (_key: string, fallback: string) => fallback,
    } as never);
    const route = (delivery: ConsumeMessage) =>
      service['route'](delivery, channel as unknown as ConfirmChannel);
    return { channel, service, route };
  };

  describe('retry delay', () => {
    it('uses exponential delays for the configured number of retries', () => {
      const { service } = setup();
      const retry = { max: 3, backoffMs: 1000 };

      expect(service['getExponentialBackoffMs'](retry, 1)).toBe(1000);
      expect(service['getExponentialBackoffMs'](retry, 2)).toBe(2000);
      expect(service['getExponentialBackoffMs'](retry, 3)).toBe(4000);
      expect(service['getExponentialBackoffMs'](retry, 4)).toBeNull();
    });

    it('does not retry when max is zero', () => {
      const { service } = setup();

      expect(
        service['getExponentialBackoffMs']({ max: 0, backoffMs: 1000 }, 1),
      ).toBeNull();
    });

    it('allows an immediate retry when backoff is zero', () => {
      const { service } = setup();

      expect(
        service['getExponentialBackoffMs']({ max: 1, backoffMs: 0 }, 1),
      ).toBe(0);
    });
  });

  it('archives nonprimary dead letters', async () => {
    const { channel, route } = setup();
    const delivery = {
      ...message(1),
      fields: { routingKey: QUEUES.FLIGHT_ALLOTMENT_COMPENSATE },
    } as ConsumeMessage;

    await route(delivery);

    expect(channel.assertQueue).toHaveBeenCalledWith(QUEUES.DLQ, {
      durable: true,
    });
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      QUEUES.DLQ,
      delivery.content,
      expect.any(Object),
      expect.any(Function),
    );
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('schedules a delayed retry with the broker death history preserved', async () => {
    const { channel, route } = setup();
    const delivery = message(1);

    await route(delivery);

    expect(channel.assertQueue).toHaveBeenCalledWith(`${queue}.retry.1000`, {
      durable: true,
      arguments: {
        'x-message-ttl': 1000,
        'x-dead-letter-exchange': 'booking.topic',
        'x-dead-letter-routing-key': queue,
      },
    });
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      `${queue}.retry.1000`,
      delivery.content,
      expect.objectContaining({ headers: delivery.properties.headers }),
      expect.any(Function),
    );
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('doubles the delay on the second rejection', async () => {
    const { channel, route } = setup();

    await route(message(2));

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      `${queue}.retry.2000`,
      expect.any(Buffer),
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('uses the backoff value carried by each dispatched step', async () => {
    const { channel, route } = setup();

    await route(message(1, { max: 2, backoffMs: 2000 }));

    expect(channel.assertQueue).toHaveBeenCalledWith(`${queue}.retry.2000`, {
      durable: true,
      arguments: {
        'x-message-ttl': 2000,
        'x-dead-letter-exchange': 'booking.topic',
        'x-dead-letter-routing-key': queue,
      },
    });
  });

  it('uses a zero-TTL delay queue for an immediate retry', async () => {
    const { channel, route } = setup();

    await route(message(1, { max: 1, backoffMs: 0 }));

    expect(channel.assertQueue).toHaveBeenCalledWith(`${queue}.retry.0`, {
      durable: true,
      arguments: {
        'x-message-ttl': 0,
        'x-dead-letter-exchange': 'booking.topic',
        'x-dead-letter-routing-key': queue,
      },
    });
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      `${queue}.retry.0`,
      expect.any(Buffer),
      expect.any(Object),
      expect.any(Function),
    );
    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('acknowledges a rejected delivery only after the retry publish is confirmed', async () => {
    const { channel, service } = setup();
    let confirm!: () => void;
    channel.sendToQueue.mockImplementation(
      (_queue, _content, _options, callback: (error: Error | null) => void) => {
        confirm = () => callback(null);
        return true;
      },
    );
    const delivery = message(1);

    const routing = service.handle(
      delivery,
      channel as unknown as ConfirmChannel,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(channel.ack).not.toHaveBeenCalled();

    confirm();
    await routing;

    expect(channel.ack).toHaveBeenCalledWith(delivery);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('publishes a failed completion and archives the message when retries are exhausted', async () => {
    const { channel, route } = setup();
    const delivery = message(3);

    await route(delivery);

    const published = channel.publish.mock.calls[0] as [
      string,
      string,
      Buffer,
      unknown,
      unknown,
    ];
    expect(published[0]).toBe('booking.topic');
    expect(published[1]).toBe('booking.step.completed.itinerary.notify');
    const completion = JSON.parse(published[2].toString()) as {
      pattern: string;
      data: { stepId: string; status: string; error: unknown };
    };
    expect(completion.pattern).toBe(published[1]);
    expect(completion.data.stepId).toBe('step-1');
    expect(completion.data.status).toBe('failed');
    expect(completion.data.error).toEqual({
      code: 'RETRY_EXHAUSTED',
      message: 'Processing failed after 3 attempts',
      retryable: false,
    });
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      QUEUES.DLQ,
      delivery.content,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('does not retry a worker configured with max zero', async () => {
    const { channel, route } = setup();

    await route(message(1, { max: 0, backoffMs: 1000 }));

    expect(channel.publish).toHaveBeenCalledTimes(1);
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      QUEUES.DLQ,
      expect.any(Buffer),
      expect.any(Object),
      expect.any(Function),
    );
  });
});
