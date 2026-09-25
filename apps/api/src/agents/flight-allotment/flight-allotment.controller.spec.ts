jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { of, throwError } from 'rxjs';
import type { RmqContext } from '@nestjs/microservices';
import { FlightAllotmentController } from './flight-allotment.controller';
import { FlightAllotmentService } from './flight-allotment.service';
import {
  BookingStepCompensateMessage,
  BookingStepDispatchMessage,
} from '@/dispatch/dispatch.types';

describe('FlightAllotmentController', () => {
  const baseMessage: BookingStepDispatchMessage = {
    stepId: 'step-1',
    bookingId: 'booking-1',
    stepName: 'flight.allotment',
    scope: 'product',
    agent: 'flight-agent',
    flightBookingId: 'flight-booking-1',
    hotelBookingId: null,
    attempt: 0,
    timeoutMs: 8000,
    retry: { max: 2, backoffMs: 2000 },
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

  it('acks and publishes a success completion when a seat is reserved', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const allotmentService = {
      reserveSeat: jest
        .fn()
        .mockResolvedValue({ reserved: true, seatsLeft: 4 }),
    } as unknown as FlightAllotmentService;
    const controller = new FlightAllotmentController(
      { emit } as never,
      allotmentService,
    );
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.flight.allotment',
      {
        stepId: 'step-1',
        bookingId: 'booking-1',
        stepName: 'flight.allotment',
        scope: 'product',
        agent: 'flight-agent',
        flightBookingId: 'flight-booking-1',
        hotelBookingId: null,
        attempt: 0,
        status: 'success',
        result: { seatsLeft: 4 },
        error: null,
      },
    );
  });

  it('acks (not nacks) and publishes a failed completion when no seat is available', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const allotmentService = {
      reserveSeat: jest.fn().mockResolvedValue({ reserved: false }),
    } as unknown as FlightAllotmentService;
    const controller = new FlightAllotmentController(
      { emit } as never,
      allotmentService,
    );
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.flight.allotment',
      expect.objectContaining({
        status: 'failed',
        error: { code: 'SEAT_UNAVAILABLE', retryable: false },
      }),
    );
  });

  it('nacks and never publishes when the reservation check throws', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const allotmentService = {
      reserveSeat: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as FlightAllotmentService;
    const controller = new FlightAllotmentController(
      { emit } as never,
      allotmentService,
    );
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
    const allotmentService = {
      reserveSeat: jest
        .fn()
        .mockResolvedValue({ reserved: true, seatsLeft: 4 }),
    } as unknown as FlightAllotmentService;
    const controller = new FlightAllotmentController(
      { emit } as never,
      allotmentService,
    );
    const { channel, context } = buildContext();

    await expect(
      controller.handle(baseMessage, context),
    ).resolves.toBeUndefined();
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  describe('handleCompensate', () => {
    const compensateMessage: BookingStepCompensateMessage = {
      stepId: 'step-1',
      bookingId: 'booking-1',
      stepName: 'flight.allotment',
      scope: 'product',
      agent: 'flight-agent',
      flightBookingId: 'flight-booking-1',
      hotelBookingId: null,
    };

    it('acks and publishes a compensated event when the seat is released', async () => {
      const emit = jest.fn().mockReturnValue(of(undefined));
      const allotmentService = {
        releaseSeat: jest.fn().mockResolvedValue({ released: true }),
      } as unknown as FlightAllotmentService;
      const controller = new FlightAllotmentController(
        { emit } as never,
        allotmentService,
      );
      const { channel, context } = buildContext();

      await controller.handleCompensate(compensateMessage, context);

      expect(channel.ack).toHaveBeenCalledTimes(1);
      expect(channel.nack).not.toHaveBeenCalled();
      expect(emit).toHaveBeenCalledWith(
        'booking.step.compensated.flight.allotment',
        {
          stepId: 'step-1',
          bookingId: 'booking-1',
          stepName: 'flight.allotment',
        },
      );
    });

    it('nacks and never publishes when the release throws', async () => {
      const emit = jest.fn().mockReturnValue(of(undefined));
      const allotmentService = {
        releaseSeat: jest.fn().mockRejectedValue(new Error('db down')),
      } as unknown as FlightAllotmentService;
      const controller = new FlightAllotmentController(
        { emit } as never,
        allotmentService,
      );
      const { channel, context } = buildContext();

      await controller.handleCompensate(compensateMessage, context);

      expect(channel.nack).toHaveBeenCalledWith({}, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });

    it('logs but does not throw when publishing the compensated event fails', async () => {
      const emit = jest
        .fn()
        .mockReturnValue(throwError(() => new Error('broker unreachable')));
      const allotmentService = {
        releaseSeat: jest.fn().mockResolvedValue({ released: true }),
      } as unknown as FlightAllotmentService;
      const controller = new FlightAllotmentController(
        { emit } as never,
        allotmentService,
      );
      const { channel, context } = buildContext();

      await expect(
        controller.handleCompensate(compensateMessage, context),
      ).resolves.toBeUndefined();
      expect(channel.ack).toHaveBeenCalledTimes(1);
    });
  });
});
