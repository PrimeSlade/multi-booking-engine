jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { HotelAvailabilityService } from './hotel-availability.service';

describe('HotelAvailabilityService', () => {
  let mockPrisma: {
    db: {
      orm: {
        public: {
          HotelBooking: { where: jest.Mock };
          Room: { where: jest.Mock };
        };
      };
    };
  };
  let service: HotelAvailabilityService;

  const mockFirst = (value: unknown) => ({
    all: jest.fn().mockReturnValue({
      first: jest.fn().mockResolvedValue(value),
    }),
  });

  beforeEach(() => {
    mockPrisma = {
      db: {
        orm: {
          public: {
            HotelBooking: { where: jest.fn() },
            Room: { where: jest.fn() },
          },
        },
      },
    };
    service = new HotelAvailabilityService(mockPrisma as never);
  });

  it('returns the selected room when it is available for the hotel', async () => {
    mockPrisma.db.orm.public.HotelBooking.where.mockReturnValue(
      mockFirst({
        id: 'hotel-booking-1',
        hotelId: 'hotel-1',
        roomId: 'hotel-1-deluxe',
      }),
    );
    mockPrisma.db.orm.public.Room.where.mockReturnValue(
      mockFirst({
        id: 'hotel-1-deluxe',
        hotelId: 'hotel-1',
        roomType: 'Deluxe',
        available: true,
      }),
    );

    const result = await service.checkAvailability('hotel-booking-1');

    expect(result).toEqual({
      available: true,
      roomId: 'hotel-1-deluxe',
      roomType: 'Deluxe',
    });
  });

  it('returns unavailable when the selected room is unavailable', async () => {
    mockPrisma.db.orm.public.HotelBooking.where.mockReturnValue(
      mockFirst({
        id: 'hotel-booking-1',
        hotelId: 'hotel-1',
        roomId: 'hotel-1-deluxe',
      }),
    );
    mockPrisma.db.orm.public.Room.where.mockReturnValue(
      mockFirst({
        id: 'hotel-1-deluxe',
        hotelId: 'hotel-1',
        roomType: 'Deluxe',
        available: false,
      }),
    );

    await expect(service.checkAvailability('hotel-booking-1')).resolves.toEqual(
      { available: false },
    );
  });

  it('returns unavailable when the room belongs to another hotel', async () => {
    mockPrisma.db.orm.public.HotelBooking.where.mockReturnValue(
      mockFirst({
        id: 'hotel-booking-1',
        hotelId: 'hotel-1',
        roomId: 'hotel-2-deluxe',
      }),
    );
    mockPrisma.db.orm.public.Room.where.mockReturnValue(
      mockFirst({
        id: 'hotel-2-deluxe',
        hotelId: 'hotel-2',
        roomType: 'Deluxe',
        available: true,
      }),
    );

    await expect(service.checkAvailability('hotel-booking-1')).resolves.toEqual(
      { available: false },
    );
  });

  it('returns unavailable when no room was selected', async () => {
    mockPrisma.db.orm.public.HotelBooking.where.mockReturnValue(
      mockFirst({
        id: 'hotel-booking-1',
        hotelId: 'hotel-1',
        roomId: null,
      }),
    );

    await expect(service.checkAvailability('hotel-booking-1')).resolves.toEqual(
      { available: false },
    );
    expect(mockPrisma.db.orm.public.Room.where).not.toHaveBeenCalled();
  });

  it('returns unavailable when the hotel booking is missing', async () => {
    mockPrisma.db.orm.public.HotelBooking.where.mockReturnValue(
      mockFirst(null),
    );

    await expect(
      service.checkAvailability('missing-hotel-booking'),
    ).resolves.toEqual({ available: false });
    expect(mockPrisma.db.orm.public.Room.where).not.toHaveBeenCalled();
  });

  it('returns unavailable when hotelBookingId is null', async () => {
    await expect(service.checkAvailability(null)).resolves.toEqual({
      available: false,
    });
    expect(mockPrisma.db.orm.public.HotelBooking.where).not.toHaveBeenCalled();
  });
});
