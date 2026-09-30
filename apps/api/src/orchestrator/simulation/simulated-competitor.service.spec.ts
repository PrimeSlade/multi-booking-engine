jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import {
  OTHER_CUSTOMER_ID,
  SimulatedCompetitorService,
} from '@/orchestrator/simulation/simulated-competitor.service';

describe('SimulatedCompetitorService', () => {
  // Builds a where(...) result that supports both reads and updates.
  const query = (rows: unknown[]) => ({
    all: () => ({
      toArray: () => Promise.resolve(rows),
      first: () => Promise.resolve(rows[0] ?? null),
    }),
    update: jest.fn().mockResolvedValue({ id: 'updated' }),
  });

  const hotelItem = {
    id: 'hb-user',
    hotelId: 'hotel-1',
    hotelName: 'Grand Hyatt',
    roomId: 'room-1',
    roomType: 'Deluxe',
    city: 'New York',
    checkIn: '2026-11-01T00:00:00.000Z',
    checkOut: '2026-11-03T00:00:00.000Z',
    rooms: 1,
    simulatedTakenCount: 0,
  };

  const flightItem = {
    id: 'fb-user',
    flightId: 'flight-1',
    flightNumber: 'BA178',
    origin: 'JFK',
    destination: 'LHR',
    departureDate: '2026-10-01T10:00:00.000Z',
    passengers: 3,
    simulatedTakenCount: 0,
  };

  let mockPrisma: {
    db: {
      orm: {
        public: {
          Booking: { create: jest.Mock; where: jest.Mock };
          FlightBooking: { create: jest.Mock; where: jest.Mock };
          HotelBooking: { create: jest.Mock; where: jest.Mock };
          Flight: { where: jest.Mock };
          Room: { where: jest.Mock };
        };
      };
    };
  };
  let mockFlightAllotment: { reserveSeat: jest.Mock };
  let mockHotelAllotment: { reserveRoom: jest.Mock };
  let otherBookingUpdate: ReturnType<typeof query>;
  let service: SimulatedCompetitorService;

  beforeEach(() => {
    otherBookingUpdate = query([]);
    mockPrisma = {
      db: {
        orm: {
          public: {
            Booking: {
              create: jest.fn().mockResolvedValue({ id: 'other-booking' }),
              where: jest.fn().mockReturnValue(otherBookingUpdate),
            },
            FlightBooking: {
              create: jest.fn().mockResolvedValue({ id: 'fb-other' }),
              where: jest.fn().mockReturnValue(query([])),
            },
            HotelBooking: {
              create: jest.fn().mockResolvedValue({ id: 'hb-other' }),
              where: jest.fn().mockReturnValue(query([])),
            },
            Flight: { where: jest.fn() },
            Room: { where: jest.fn() },
          },
        },
      },
    };
    mockFlightAllotment = {
      reserveSeat: jest
        .fn()
        .mockResolvedValue({ reserved: true, seatsLeft: 2 }),
    };
    mockHotelAllotment = {
      reserveRoom: jest
        .fn()
        .mockResolvedValue({ reserved: true, roomsLeft: 0 }),
    };
    service = new SimulatedCompetitorService(
      mockPrisma as never,
      mockFlightAllotment as never,
      mockHotelAllotment as never,
    );
  });

  it('books the room as another customer, leaving one fewer than requested', async () => {
    const userItemUpdate = query([]);
    mockPrisma.db.orm.public.HotelBooking.where
      .mockReturnValueOnce(query([hotelItem]))
      .mockReturnValueOnce(userItemUpdate);
    mockPrisma.db.orm.public.Room.where.mockReturnValueOnce(
      query([{ id: 'room-1', roomsLeft: 8 }]),
    );

    await service.takeMarkedItems('booking-1');

    // A real booking for the other customer, for all 8 rooms.
    expect(mockPrisma.db.orm.public.Booking.create).toHaveBeenCalledWith({
      userId: OTHER_CUSTOMER_ID,
      status: 'in_progress',
    });
    expect(mockPrisma.db.orm.public.HotelBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'other-booking',
        roomId: 'room-1',
        rooms: 8,
      }),
    );
    // Reserved through the normal allotment code.
    expect(mockHotelAllotment.reserveRoom).toHaveBeenCalledWith('hb-other');
    expect(otherBookingUpdate.update).toHaveBeenCalledWith({
      status: 'confirmed',
    });
    expect(userItemUpdate.update).toHaveBeenCalledWith({
      simulatedTakenCount: 8,
    });
  });

  it('books seats as another customer when more than one passenger is requested', async () => {
    mockPrisma.db.orm.public.FlightBooking.where.mockReturnValueOnce(
      query([flightItem]),
    );
    mockPrisma.db.orm.public.Flight.where.mockReturnValueOnce(
      query([{ id: 'flight-1', seatsLeft: 10 }]),
    );

    await service.takeMarkedItems('booking-1');

    // 3 requested, so it leaves 2 behind: books 8.
    expect(mockPrisma.db.orm.public.FlightBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'other-booking',
        flightId: 'flight-1',
        passengers: 8,
      }),
    );
    expect(mockFlightAllotment.reserveSeat).toHaveBeenCalledWith('fb-other');
  });

  it('does not create a booking when the item already cannot fit', async () => {
    mockPrisma.db.orm.public.HotelBooking.where.mockReturnValueOnce(
      query([{ ...hotelItem, rooms: 3 }]),
    );
    mockPrisma.db.orm.public.Room.where.mockReturnValueOnce(
      query([{ id: 'room-1', roomsLeft: 2 }]),
    );

    await service.takeMarkedItems('booking-1');

    expect(mockPrisma.db.orm.public.Booking.create).not.toHaveBeenCalled();
  });

  it('does not take an item again once it has been taken', async () => {
    mockPrisma.db.orm.public.HotelBooking.where.mockReturnValueOnce(
      query([{ ...hotelItem, simulatedTakenCount: 8 }]),
    );

    await service.takeMarkedItems('booking-1');

    expect(mockPrisma.db.orm.public.Room.where).not.toHaveBeenCalled();
    expect(mockPrisma.db.orm.public.Booking.create).not.toHaveBeenCalled();
  });

  it('marks the other booking failed and records nothing when its reservation fails', async () => {
    mockHotelAllotment.reserveRoom.mockResolvedValueOnce({ reserved: false });
    mockPrisma.db.orm.public.HotelBooking.where.mockReturnValueOnce(
      query([hotelItem]),
    );
    mockPrisma.db.orm.public.Room.where.mockReturnValueOnce(
      query([{ id: 'room-1', roomsLeft: 8 }]),
    );

    await service.takeMarkedItems('booking-1');

    expect(otherBookingUpdate.update).toHaveBeenCalledWith({
      status: 'failed',
    });
    // Only the initial read; the user's item is never updated.
    expect(mockPrisma.db.orm.public.HotelBooking.where).toHaveBeenCalledTimes(
      1,
    );
  });
});
