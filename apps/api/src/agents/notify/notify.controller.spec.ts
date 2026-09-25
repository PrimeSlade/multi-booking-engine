import { of, throwError } from 'rxjs';
import { Logger } from '@nestjs/common';
import type { RmqContext } from '@nestjs/microservices';
import { NotifyController } from './notify.controller';
import { NotifyService } from './notify.service';
import { BookingStepDispatchMessage } from '@/dispatch/dispatch.types';

describe('NotifyController', () => {
  const baseMessage: BookingStepDispatchMessage = {
    stepId: 'step-notify',
    bookingId: 'booking-1',
    stepName: 'itinerary.notify',
    scope: 'itinerary',
    agent: 'notify-agent',
    flightBookingId: null,
    hotelBookingId: null,
    attempt: 0,
    timeoutMs: 3000,
    retry: { max: 3, backoffMs: 1000 },
  };

  const buildContext = () => {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const originalMsg = {};
    const context = {
      getChannelRef: () => channel,
      getMessage: () => originalMsg,
    } as unknown as RmqContext;
    return { channel, context };
  };

  afterEach(() => jest.restoreAllMocks());

  it('acks and publishes a success completion', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const notifyService = {
      sendNotification: jest.fn().mockResolvedValue({ notified: true }),
    } as unknown as NotifyService;
    const controller = new NotifyController({ emit } as never, notifyService);
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.itinerary.notify',
      {
        stepId: 'step-notify',
        bookingId: 'booking-1',
        stepName: 'itinerary.notify',
        scope: 'itinerary',
        agent: 'notify-agent',
        flightBookingId: null,
        hotelBookingId: null,
        attempt: 0,
        status: 'success',
        result: { notified: true },
        error: null,
      },
    );
  });

  it('nacks and does not publish when notification fails', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const emit = jest.fn().mockReturnValue(of(undefined));
    const notifyService = {
      sendNotification: jest.fn().mockRejectedValue(new Error('send failed')),
    } as unknown as NotifyService;
    const controller = new NotifyController({ emit } as never, notifyService);
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.nack).toHaveBeenCalledWith({}, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('itinerary.notify failed for stepId=step-notify'),
      expect.stringContaining('send failed'),
    );
  });

  it('logs but does not throw when publishing the completion fails', async () => {
    const emit = jest
      .fn()
      .mockReturnValue(throwError(() => new Error('broker unreachable')));
    const notifyService = {
      sendNotification: jest.fn().mockResolvedValue({ notified: true }),
    } as unknown as NotifyService;
    const controller = new NotifyController({ emit } as never, notifyService);
    const { channel, context } = buildContext();

    await expect(
      controller.handle(baseMessage, context),
    ).resolves.toBeUndefined();
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });
});
