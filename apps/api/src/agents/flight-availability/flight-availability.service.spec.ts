jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { FlightAvailabilityService } from './flight-availability.service';

describe('FlightAvailabilityService', () => {
  let mockPrisma: {
    db: {
      orm: {
        public: {
          FlightBooking: { where: jest.Mock };
          Flight: { where: jest.Mock };
        };
      };
    };
  };
  let service: FlightAvailabilityService;

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
            FlightBooking: { where: jest.fn() },
            Flight: { where: jest.fn() },
          },
        },
      },
    };
    service = new FlightAvailabilityService(mockPrisma as never);
  });

  it('returns available with seatsLeft when the flight has seats', async () => {
    mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
      mockFirst({ id: 'fb-1', flightId: 'flight-1' }),
    );
    mockPrisma.db.orm.public.Flight.where.mockReturnValue(
      mockFirst({ id: 'flight-1', seatsLeft: 5 }),
    );

    const result = await service.checkAvailability('fb-1');

    expect(result).toEqual({ available: true, seatsLeft: 5 });
  });

  it('returns unavailable when the flight is sold out', async () => {
    mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
      mockFirst({ id: 'fb-1', flightId: 'flight-1' }),
    );
    mockPrisma.db.orm.public.Flight.where.mockReturnValue(
      mockFirst({ id: 'flight-1', seatsLeft: 0 }),
    );

    const result = await service.checkAvailability('fb-1');

    expect(result).toEqual({ available: false });
  });

  it('returns unavailable when the flight booking is missing', async () => {
    mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
      mockFirst(null),
    );

    const result = await service.checkAvailability('fb-missing');

    expect(result).toEqual({ available: false });
    expect(mockPrisma.db.orm.public.Flight.where).not.toHaveBeenCalled();
  });

  it('returns unavailable when flightBookingId is null', async () => {
    const result = await service.checkAvailability(null);

    expect(result).toEqual({ available: false });
    expect(mockPrisma.db.orm.public.FlightBooking.where).not.toHaveBeenCalled();
  });
});
