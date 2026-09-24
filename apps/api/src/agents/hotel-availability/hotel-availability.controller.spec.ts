jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { of, throwError } from 'rxjs';
import type { RmqContext } from '@nestjs/microservices';
import { HotelAvailabilityController } from './hotel-availability.controller';
import { HotelAvailabilityService } from './hotel-availability.service';
import { BookingStepDispatchMessage } from '@/dispatch/dispatch.types';

describe('HotelAvailabilityController', () => {
  const baseMessage: BookingStepDispatchMessage = {
    stepId: 'step-hotel-availability',
    bookingId: 'booking-1',
    stepName: 'hotel.availability',
    scope: 'product',
    agent: 'hotel-agent',
    flightBookingId: null,
    hotelBookingId: 'hotel-booking-1',
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

  it('acks and publishes success when the selected room is available', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const availabilityService = {
      checkAvailability: jest.fn().mockResolvedValue({
        available: true,
        roomId: 'hotel-1-deluxe',
        roomType: 'Deluxe',
        roomsLeft: 5,
      }),
    } as unknown as HotelAvailabilityService;
    const controller = new HotelAvailabilityController(
      { emit } as never,
      availabilityService,
    );
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.hotel.availability',
      {
        stepId: 'step-hotel-availability',
        bookingId: 'booking-1',
        stepName: 'hotel.availability',
        scope: 'product',
        agent: 'hotel-agent',
        flightBookingId: null,
        hotelBookingId: 'hotel-booking-1',
        attempt: 0,
        status: 'success',
        result: {
          roomId: 'hotel-1-deluxe',
          roomType: 'Deluxe',
          roomsLeft: 5,
        },
        error: null,
      },
    );
  });

  it('acks and publishes a non-retryable failure when unavailable', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const availabilityService = {
      checkAvailability: jest.fn().mockResolvedValue({ available: false }),
    } as unknown as HotelAvailabilityService;
    const controller = new HotelAvailabilityController(
      { emit } as never,
      availabilityService,
    );
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      'booking.step.completed.hotel.availability',
      expect.objectContaining({
        status: 'failed',
        error: { code: 'NO_AVAILABILITY', retryable: false },
      }),
    );
  });

  it('nacks and does not publish when the catalog check throws', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const availabilityService = {
      checkAvailability: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as HotelAvailabilityService;
    const controller = new HotelAvailabilityController(
      { emit } as never,
      availabilityService,
    );
    const { channel, context } = buildContext();

    await controller.handle(baseMessage, context);

    expect(channel.nack).toHaveBeenCalledWith({}, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('logs but does not throw when publishing completion fails', async () => {
    const emit = jest
      .fn()
      .mockReturnValue(throwError(() => new Error('broker unreachable')));
    const availabilityService = {
      checkAvailability: jest.fn().mockResolvedValue({
        available: true,
        roomId: 'hotel-1-deluxe',
        roomType: 'Deluxe',
        roomsLeft: 5,
      }),
    } as unknown as HotelAvailabilityService;
    const controller = new HotelAvailabilityController(
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
