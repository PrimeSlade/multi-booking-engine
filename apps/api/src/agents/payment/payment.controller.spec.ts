jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { of, throwError } from 'rxjs';
import type { RmqContext } from '@nestjs/microservices';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { BookingStepDispatchMessage } from '@/dispatch/dispatch.types';

describe('PaymentController', () => {
  const baseMessage: BookingStepDispatchMessage = {
    stepId: 'step-1',
    bookingId: 'booking-1',
    stepName: 'itinerary.payment',
    scope: 'itinerary',
    agent: 'payment-agent',
    flightBookingId: null,
    hotelBookingId: null,
    attempt: 0,
    timeoutMs: 10000,
    retry: { max: 2, backoffMs: 2000 },
  };

  const buildContext = () => {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const context = {
      getChannelRef: () => channel,
      getMessage: () => ({}),
    } as unknown as RmqContext;
    return { channel, context };
  };

  it('acks and publishes a success completion when payment is not declined', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const paymentService = {
      processPayment: jest.fn().mockResolvedValue(false),
    } as unknown as PaymentService;
    const controller = new PaymentController({ emit } as never, paymentService);
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.itinerary.payment',
      {
        stepId: 'step-1',
        bookingId: 'booking-1',
        stepName: 'itinerary.payment',
        scope: 'itinerary',
        agent: 'payment-agent',
        flightBookingId: null,
        hotelBookingId: null,
        attempt: 0,
        status: 'success',
        result: null,
        error: null,
      },
    );
  });

  it('acks (not nacks) and publishes a failed completion when payment is declined', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const paymentService = {
      processPayment: jest.fn().mockResolvedValue(true),
    } as unknown as PaymentService;
    const controller = new PaymentController({ emit } as never, paymentService);
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.itinerary.payment',
      expect.objectContaining({
        status: 'failed',
        error: { code: 'PAYMENT_DECLINED', retryable: false },
      }),
    );
  });

  it('nacks and never publishes when the payment check throws', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const paymentService = {
      processPayment: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as PaymentService;
    const controller = new PaymentController({ emit } as never, paymentService);
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
    const paymentService = {
      processPayment: jest.fn().mockResolvedValue(false),
    } as unknown as PaymentService;
    const controller = new PaymentController({ emit } as never, paymentService);
    const { channel, context } = buildContext();

    await expect(
      controller.handle(baseMessage, context),
    ).resolves.toBeUndefined();
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });
});
