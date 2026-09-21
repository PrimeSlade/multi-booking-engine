jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { of, throwError } from 'rxjs';
import type { RmqContext } from '@nestjs/microservices';
import { FraudController } from './fraud.controller';
import { FraudService } from './fraud.service';
import { BookingStepDispatchMessage } from '@/dispatch/dispatch.types';

describe('FraudController', () => {
  const baseMessage: BookingStepDispatchMessage = {
    stepId: 'step-1',
    bookingId: 'booking-1',
    stepName: 'itinerary.fraud',
    scope: 'itinerary',
    agent: 'fraud-agent',
    flightBookingId: null,
    hotelBookingId: null,
    attempt: 0,
    timeoutMs: 4000,
    retry: { max: 2, backoffMs: 1000 },
  };

  const buildContext = () => {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const context = {
      getChannelRef: () => channel,
      getMessage: () => ({}),
    } as unknown as RmqContext;
    return { channel, context };
  };

  it('acks and publishes a success completion when the booking is not flagged', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const fraudService = {
      checkFraud: jest.fn().mockResolvedValue(false),
    } as unknown as FraudService;
    const controller = new FraudController({ emit } as never, fraudService);
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.itinerary.fraud',
      {
        stepId: 'step-1',
        bookingId: 'booking-1',
        stepName: 'itinerary.fraud',
        scope: 'itinerary',
        agent: 'fraud-agent',
        flightBookingId: null,
        hotelBookingId: null,
        attempt: 0,
        status: 'success',
        result: null,
        error: null,
      },
    );
  });

  it('acks (not nacks) and publishes a failed completion when the booking is flagged', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const fraudService = {
      checkFraud: jest.fn().mockResolvedValue(true),
    } as unknown as FraudService;
    const controller = new FraudController({ emit } as never, fraudService);
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.itinerary.fraud',
      expect.objectContaining({
        status: 'failed',
        error: { code: 'FRAUD_DETECTED', retryable: false },
      }),
    );
  });

  it('nacks and never publishes when the fraud check throws', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const fraudService = {
      checkFraud: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as FraudService;
    const controller = new FraudController({ emit } as never, fraudService);
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.nack).toHaveBeenCalledWith({}, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('logs but does not throw when publishing the completion fails', async () => {
    const emit = jest
      .fn()
      .mockReturnValue(throwError(() => new Error('broker unreachable')));
    const fraudService = {
      checkFraud: jest.fn().mockResolvedValue(false),
    } as unknown as FraudService;
    const controller = new FraudController({ emit } as never, fraudService);
    const { channel, context } = buildContext();

    await expect(
      controller.handle(baseMessage, context),
    ).resolves.toBeUndefined();
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });
});
