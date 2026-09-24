jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { of, throwError } from 'rxjs';
import type { RmqContext } from '@nestjs/microservices';
import { HotelAllotmentController } from './hotel-allotment.controller';
import { HotelAllotmentService } from './hotel-allotment.service';
import {
  BookingStepCompensateMessage,
  BookingStepDispatchMessage,
} from '@/dispatch/dispatch.types';

describe('HotelAllotmentController', () => {
  const baseMessage: BookingStepDispatchMessage = {
    stepId: 'step-1',
    bookingId: 'booking-1',
    stepName: 'hotel.allotment',
    scope: 'product',
    agent: 'hotel-agent',
    flightBookingId: null,
    hotelBookingId: 'hotel-booking-1',
    attempt: 0,
    timeoutMs: 8000,
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

  it('acks and publishes success when rooms are reserved', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const service = {
      reserveRoom: jest
        .fn()
        .mockResolvedValue({ reserved: true, roomsLeft: 8 }),
    } as unknown as HotelAllotmentService;
    const controller = new HotelAllotmentController({ emit } as never, service);
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.hotel.allotment',
      expect.objectContaining({
        status: 'success',
        result: { roomsLeft: 8 },
        error: null,
      }),
    );
  });

  it('acks and publishes a non-retryable failure when rooms are unavailable', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const service = {
      reserveRoom: jest.fn().mockResolvedValue({ reserved: false }),
    } as unknown as HotelAllotmentService;
    const controller = new HotelAllotmentController({ emit } as never, service);
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.hotel.allotment',
      expect.objectContaining({
        status: 'failed',
        error: { code: 'ROOM_UNAVAILABLE', retryable: false },
      }),
    );
  });

  it('nacks and does not publish when reservation throws', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const service = {
      reserveRoom: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as HotelAllotmentService;
    const controller = new HotelAllotmentController({ emit } as never, service);
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.nack).toHaveBeenCalledWith({}, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('logs but does not throw when completion publishing fails', async () => {
    const emit = jest
      .fn()
      .mockReturnValue(throwError(() => new Error('broker unreachable')));
    const service = {
      reserveRoom: jest
        .fn()
        .mockResolvedValue({ reserved: true, roomsLeft: 8 }),
    } as unknown as HotelAllotmentService;
    const controller = new HotelAllotmentController({ emit } as never, service);
    const { channel, context } = buildContext();

    await expect(
      controller.handle(baseMessage, context),
    ).resolves.toBeUndefined();
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  describe('handleCompensate', () => {
    const message: BookingStepCompensateMessage = {
      stepId: 'step-1',
      bookingId: 'booking-1',
      stepName: 'hotel.allotment',
      scope: 'product',
      agent: 'hotel-agent',
      flightBookingId: null,
      hotelBookingId: 'hotel-booking-1',
    };

    it('acks and publishes compensated when rooms are released', async () => {
      const emit = jest.fn().mockReturnValue(of(undefined));
      const service = {
        releaseRoom: jest.fn().mockResolvedValue({ released: true }),
      } as unknown as HotelAllotmentService;
      const controller = new HotelAllotmentController(
        { emit } as never,
        service,
      );
      const { channel, context } = buildContext();

      await controller.handleCompensate(message, context);

      expect(channel.ack).toHaveBeenCalledTimes(1);
      expect(channel.nack).not.toHaveBeenCalled();
      expect(emit).toHaveBeenCalledWith(
        'booking.step.compensated.hotel.allotment',
        {
          stepId: 'step-1',
          bookingId: 'booking-1',
          stepName: 'hotel.allotment',
        },
      );
    });

    it('nacks and does not publish when release throws', async () => {
      const emit = jest.fn().mockReturnValue(of(undefined));
      const service = {
        releaseRoom: jest.fn().mockRejectedValue(new Error('db down')),
      } as unknown as HotelAllotmentService;
      const controller = new HotelAllotmentController(
        { emit } as never,
        service,
      );
      const { channel, context } = buildContext();

      await controller.handleCompensate(message, context);

      expect(channel.nack).toHaveBeenCalledWith({}, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });

    it('logs but does not throw when compensated publishing fails', async () => {
      const emit = jest
        .fn()
        .mockReturnValue(throwError(() => new Error('broker unreachable')));
      const service = {
        releaseRoom: jest.fn().mockResolvedValue({ released: true }),
      } as unknown as HotelAllotmentService;
      const controller = new HotelAllotmentController(
        { emit } as never,
        service,
      );
      const { channel, context } = buildContext();

      await expect(
        controller.handleCompensate(message, context),
      ).resolves.toBeUndefined();
      expect(channel.ack).toHaveBeenCalledTimes(1);
    });
  });
});
