jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { of, throwError } from 'rxjs';
import type { RmqContext } from '@nestjs/microservices';
import { FlightAvailabilityController } from './flight-availability.controller';
import { FlightAvailabilityService } from './flight-availability.service';
import { BookingStepDispatchMessage } from '@/dispatch/dispatch.types';

describe('FlightAvailabilityController', () => {
  const baseMessage: BookingStepDispatchMessage = {
    stepId: 'step-1',
    bookingId: 'booking-1',
    stepName: 'flight.availability',
    scope: 'product',
    agent: 'flight-agent',
    flightBookingId: 'flight-booking-1',
    hotelBookingId: null,
    attempt: 0,
    timeoutMs: 5000,
    retry: { max: 3, backoffMs: 1000 },
  };

  const buildContext = () => {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const context = {
      getChannelRef: () => channel,
      getMessage: () => ({}),
    } as unknown as RmqContext;
    return { channel, context };
  };

  it('acks and publishes a success completion when the flight is available', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const availabilityService = {
      checkAvailability: jest.fn().mockResolvedValue({
        available: true,
        seatsLeft: 5,
      }),
    } as unknown as FlightAvailabilityService;
    const controller = new FlightAvailabilityController(
      { emit } as never,
      availabilityService,
    );
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.flight.availability',
      {
        stepId: 'step-1',
        bookingId: 'booking-1',
        stepName: 'flight.availability',
        scope: 'product',
        agent: 'flight-agent',
        flightBookingId: 'flight-booking-1',
        hotelBookingId: null,
        attempt: 0,
        status: 'success',
        result: { seatsLeft: 5 },
        error: null,
      },
    );
  });

  it('acks (not nacks) and publishes a failed completion when the flight is sold out', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const availabilityService = {
      checkAvailability: jest.fn().mockResolvedValue({ available: false }),
    } as unknown as FlightAvailabilityService;
    const controller = new FlightAvailabilityController(
      { emit } as never,
      availabilityService,
    );
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.flight.availability',
      expect.objectContaining({
        status: 'failed',
        error: { code: 'NO_AVAILABILITY', retryable: false },
      }),
    );
  });

  it('nacks and never publishes when the catalog check throws', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const availabilityService = {
      checkAvailability: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as FlightAvailabilityService;
    const controller = new FlightAvailabilityController(
      { emit } as never,
      availabilityService,
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
    const availabilityService = {
      checkAvailability: jest.fn().mockResolvedValue({
        available: true,
        seatsLeft: 5,
      }),
    } as unknown as FlightAvailabilityService;
    const controller = new FlightAvailabilityController(
      { emit } as never,
      availabilityService,
    );
    const { channel, context } = buildContext();

    await expect(
      controller.handle(baseMessage, context),
    ).resolves.toBeUndefined();
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });
});
