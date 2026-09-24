jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { HotelAllotmentService } from './hotel-allotment.service';

describe('HotelAllotmentService', () => {
  let mockPrisma: {
    db: {
      orm: { public: { HotelBooking: { where: jest.Mock } } };
      sql: { public: { room: { update: jest.Mock; columns: unknown } } };
      runtime: jest.Mock;
    };
  };
  let service: HotelAllotmentService;

  const mockFirst = (value: unknown) => ({
    all: jest.fn().mockReturnValue({
      first: jest.fn().mockResolvedValue(value),
    }),
  });

  const buildRoomTableMock = () => {
    const chain = {
      update: jest.fn(),
      where: jest.fn(),
      returning: jest.fn(),
      build: jest.fn().mockReturnValue('plan-sentinel'),
      columns: { id: 'id-column', rooms_left: 'rooms-left-column' },
    };
    chain.update.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.returning.mockReturnValue(chain);
    return chain;
  };

  beforeEach(() => {
    mockPrisma = {
      db: {
        orm: { public: { HotelBooking: { where: jest.fn() } } },
        sql: { public: { room: buildRoomTableMock() } },
        runtime: jest.fn(),
      },
    };
    service = new HotelAllotmentService(mockPrisma as never);
  });

  it('reserves the requested rooms and returns the remaining inventory', async () => {
    mockPrisma.db.orm.public.HotelBooking.where.mockReturnValue(
      mockFirst({
        id: 'hb-1',
        hotelId: 'hotel-1',
        roomId: 'room-1',
        rooms: 2,
      }),
    );
    mockPrisma.db.runtime.mockReturnValue({
      query: jest.fn().mockResolvedValue([{ id: 'room-1', rooms_left: 8 }]),
    });

    await expect(service.reserveRoom('hb-1')).resolves.toEqual({
      reserved: true,
      roomsLeft: 8,
    });
  });

  it('returns unreserved when inventory is insufficient', async () => {
    mockPrisma.db.orm.public.HotelBooking.where.mockReturnValue(
      mockFirst({
        id: 'hb-1',
        hotelId: 'hotel-1',
        roomId: 'room-1',
        rooms: 2,
      }),
    );
    mockPrisma.db.runtime.mockReturnValue({
      query: jest.fn().mockResolvedValue([]),
    });

    await expect(service.reserveRoom('hb-1')).resolves.toEqual({
      reserved: false,
    });
  });

  it.each([
    ['missing booking', 'hb-missing', null],
    ['missing room selection', 'hb-1', { id: 'hb-1', roomId: null }],
  ])('returns unreserved for %s', async (_label, id, booking) => {
    mockPrisma.db.orm.public.HotelBooking.where.mockReturnValue(
      mockFirst(booking),
    );

    await expect(service.reserveRoom(id)).resolves.toEqual({ reserved: false });
    expect(mockPrisma.db.runtime).not.toHaveBeenCalled();
  });

  it('returns unreserved when hotelBookingId is null', async () => {
    await expect(service.reserveRoom(null)).resolves.toEqual({
      reserved: false,
    });
    expect(mockPrisma.db.orm.public.HotelBooking.where).not.toHaveBeenCalled();
  });

  describe('releaseRoom', () => {
    it('restores the requested rooms', async () => {
      mockPrisma.db.orm.public.HotelBooking.where.mockReturnValue(
        mockFirst({
          id: 'hb-1',
          hotelId: 'hotel-1',
          roomId: 'room-1',
          rooms: 2,
        }),
      );
      mockPrisma.db.runtime.mockReturnValue({
        query: jest.fn().mockResolvedValue([{ id: 'room-1', rooms_left: 10 }]),
      });

      await expect(service.releaseRoom('hb-1')).resolves.toEqual({
        released: true,
      });
    });

    it('returns not released when no room matches', async () => {
      mockPrisma.db.orm.public.HotelBooking.where.mockReturnValue(
        mockFirst({
          id: 'hb-1',
          hotelId: 'hotel-1',
          roomId: 'room-1',
          rooms: 2,
        }),
      );
      mockPrisma.db.runtime.mockReturnValue({
        query: jest.fn().mockResolvedValue([]),
      });

      await expect(service.releaseRoom('hb-1')).resolves.toEqual({
        released: false,
      });
    });

    it('returns not released when the booking or room selection is missing', async () => {
      mockPrisma.db.orm.public.HotelBooking.where.mockReturnValue(
        mockFirst(null),
      );

      await expect(service.releaseRoom('hb-missing')).resolves.toEqual({
        released: false,
      });
      expect(mockPrisma.db.runtime).not.toHaveBeenCalled();
    });

    it('returns not released when hotelBookingId is null', async () => {
      await expect(service.releaseRoom(null)).resolves.toEqual({
        released: false,
      });
      expect(
        mockPrisma.db.orm.public.HotelBooking.where,
      ).not.toHaveBeenCalled();
    });
  });
});
