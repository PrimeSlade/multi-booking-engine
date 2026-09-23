jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { FlightAllotmentService } from './flight-allotment.service';

describe('FlightAllotmentService', () => {
  let mockPrisma: {
    db: {
      orm: { public: { FlightBooking: { where: jest.Mock } } };
      sql: { public: { flight: { update: jest.Mock; columns: unknown } } };
      runtime: jest.Mock;
    };
  };
  let service: FlightAllotmentService;

  const mockFirst = (value: unknown) => ({
    all: jest.fn().mockReturnValue({
      first: jest.fn().mockResolvedValue(value),
    }),
  });

  const buildFlightTableMock = () => {
    const chain = {
      update: jest.fn(),
      where: jest.fn(),
      returning: jest.fn(),
      build: jest.fn().mockReturnValue('plan-sentinel'),
      columns: { id: 'id-column', seats_left: 'seats-left-column' },
    };
    chain.update.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.returning.mockReturnValue(chain);
    return chain;
  };

  beforeEach(() => {
    const flightTable = buildFlightTableMock();
    mockPrisma = {
      db: {
        orm: { public: { FlightBooking: { where: jest.fn() } } },
        sql: { public: { flight: flightTable } },
        runtime: jest.fn(),
      },
    };
    service = new FlightAllotmentService(mockPrisma as never);
  });

  it('returns reserved with seatsLeft when a seat is claimed', async () => {
    mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
      mockFirst({ id: 'fb-1', flightId: 'flight-1', passengers: 2 }),
    );
    mockPrisma.db.runtime.mockReturnValue({
      query: jest.fn().mockResolvedValue([{ id: 'flight-1', seats_left: 3 }]),
    });

    const result = await service.reserveSeat('fb-1');

    expect(result).toEqual({ reserved: true, seatsLeft: 3 });
  });

  it('returns unreserved when there are not enough seats', async () => {
    mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
      mockFirst({ id: 'fb-1', flightId: 'flight-1', passengers: 2 }),
    );
    mockPrisma.db.runtime.mockReturnValue({
      query: jest.fn().mockResolvedValue([]),
    });

    const result = await service.reserveSeat('fb-1');

    expect(result).toEqual({ reserved: false });
  });

  it('returns unreserved when the flight booking is missing', async () => {
    mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
      mockFirst(null),
    );

    const result = await service.reserveSeat('fb-missing');

    expect(result).toEqual({ reserved: false });
    expect(mockPrisma.db.runtime).not.toHaveBeenCalled();
  });

  it('returns unreserved when flightBookingId is null', async () => {
    const result = await service.reserveSeat(null);

    expect(result).toEqual({ reserved: false });
    expect(mockPrisma.db.orm.public.FlightBooking.where).not.toHaveBeenCalled();
  });

  describe('releaseSeat', () => {
    it('returns released when the seat is given back', async () => {
      mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
        mockFirst({ id: 'fb-1', flightId: 'flight-1', passengers: 2 }),
      );
      mockPrisma.db.runtime.mockReturnValue({
        query: jest.fn().mockResolvedValue([{ id: 'flight-1', seats_left: 5 }]),
      });

      const result = await service.releaseSeat('fb-1');

      expect(result).toEqual({ released: true });
    });

    it('returns not released when no row matched', async () => {
      mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
        mockFirst({ id: 'fb-1', flightId: 'flight-1', passengers: 2 }),
      );
      mockPrisma.db.runtime.mockReturnValue({
        query: jest.fn().mockResolvedValue([]),
      });

      const result = await service.releaseSeat('fb-1');

      expect(result).toEqual({ released: false });
    });

    it('returns not released when the flight booking is missing', async () => {
      mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
        mockFirst(null),
      );

      const result = await service.releaseSeat('fb-missing');

      expect(result).toEqual({ released: false });
      expect(mockPrisma.db.runtime).not.toHaveBeenCalled();
    });

    it('returns not released when flightBookingId is null', async () => {
      const result = await service.releaseSeat(null);

      expect(result).toEqual({ released: false });
      expect(
        mockPrisma.db.orm.public.FlightBooking.where,
      ).not.toHaveBeenCalled();
    });
  });
});
