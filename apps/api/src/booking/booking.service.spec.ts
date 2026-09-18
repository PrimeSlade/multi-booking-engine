jest.mock('@nestjs/config', () => ({
  ConfigService: class MockConfigService {},
}));

jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  StepDispatchService,
  StepPair,
} from '@/dispatch/step-dispatch.service';
import { GraphService } from '@/graph/graph.service';
import { PublishBookingDto } from './dto/publish-booking.dto';

describe('BookingService', () => {
  let service: BookingService;

  const mockCreatedBooking = {
    id: 'booking-uuid-1',
    userId: 'user-123',
    status: 'in_progress',
  };

  const mockFlightBookings = [
    { id: 'flight-booking-uuid-1', bookingId: 'booking-uuid-1' },
  ];

  const mockHotelBookings = [
    { id: 'hotel-booking-uuid-1', bookingId: 'booking-uuid-1' },
  ];

  const mockCreatedSteps = [
    {
      id: 'step-uuid-1',
      bookingId: 'booking-uuid-1',
      flightBookingId: null,
      hotelBookingId: null,
      stepIndex: 0,
      stage: 0,
      stepName: 'flight.availability',
      scope: 'product',
      agent: 'flight-agent',
      status: 'pending',
      attempt: 0,
    },
    {
      id: 'step-uuid-2',
      bookingId: 'booking-uuid-1',
      flightBookingId: null,
      hotelBookingId: null,
      stepIndex: 1,
      stage: 1,
      stepName: 'itinerary.fraud',
      scope: 'itinerary',
      agent: 'fraud-agent',
      status: 'pending',
      attempt: 0,
    },
  ];

  let flightBookingCounter: number;
  let hotelBookingCounter: number;

  const mockPrisma = {
    db: {
      orm: {
        public: {
          Booking: {
            create: jest.fn().mockResolvedValue(mockCreatedBooking),
            where: jest.fn().mockReturnValue({
              all: jest.fn().mockReturnValue({
                first: jest.fn().mockResolvedValue(mockCreatedBooking),
              }),
            }),
          },
          FlightBooking: {
            create: jest.fn().mockImplementation((data: object) =>
              Promise.resolve({
                id: `flight-booking-${flightBookingCounter++}`,
                ...data,
              }),
            ),
            where: jest.fn().mockReturnValue({
              all: jest.fn().mockReturnValue({
                toArray: jest.fn().mockResolvedValue(mockFlightBookings),
              }),
            }),
          },
          HotelBooking: {
            create: jest.fn().mockImplementation((data: object) =>
              Promise.resolve({
                id: `hotel-booking-${hotelBookingCounter++}`,
                ...data,
              }),
            ),
            where: jest.fn().mockReturnValue({
              all: jest.fn().mockReturnValue({
                toArray: jest.fn().mockResolvedValue(mockHotelBookings),
              }),
            }),
          },
          BookingStep: {
            create: jest
              .fn()
              .mockImplementation((data: { stepIndex: number }) =>
                Promise.resolve({
                  id: `step-${data.stepIndex}`,
                  ...data,
                }),
              ),
            where: jest.fn().mockReturnValue({
              all: jest.fn().mockReturnValue({
                toArray: jest.fn().mockResolvedValue([...mockCreatedSteps]),
              }),
            }),
          },
        },
      },
    },
  };

  const mockGraphService = {
    generate: jest.fn().mockReturnValue({
      version: 1,
      stages: [],
      steps: [
        {
          stage: 0,
          stepName: 'flight.availability',
          scope: 'product',
          product: 'flight',
          agent: 'flight-agent',
          routingKey: 'booking.step.flight.availability',
          timeoutMs: 5000,
          retry: { max: 3, backoffMs: 1000 },
        },
        {
          stage: 0,
          stepName: 'hotel.availability',
          scope: 'product',
          product: 'hotel',
          agent: 'hotel-agent',
          routingKey: 'booking.step.hotel.availability',
          timeoutMs: 5000,
          retry: { max: 3, backoffMs: 1000 },
        },
        {
          stage: 1,
          stepName: 'itinerary.fraud',
          scope: 'itinerary',
          product: null,
          agent: 'fraud-agent',
          routingKey: 'booking.step.itinerary.fraud',
          timeoutMs: 4000,
          retry: { max: 2, backoffMs: 1000 },
        },
      ],
      onPartialFailure: 'awaiting_user_decision',
      decisionTtlMs: 900000,
      onDecisionTimeout: 'reject_all_and_compensate',
    }),
  };

  const mockDispatchService = {
    dispatchStage0: jest
      .fn<Promise<void>, [StepPair[]]>()
      .mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GraphService, useValue: mockGraphService },
        { provide: StepDispatchService, useValue: mockDispatchService },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    flightBookingCounter = 0;
    hotelBookingCounter = 0;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should create the booking, one row per submitted product in its own table, and fan out product steps per item', async () => {
      const dto: PublishBookingDto = {
        userId: 'user-123',
        products: [
          {
            type: 'flight',
            flightId: 'flight-ba-178',
            flightNumber: 'BA178',
            origin: 'NYC',
            destination: 'LAX',
            departureDate: '2026-10-01T00:00:00.000Z',
          },
          {
            type: 'hotel',
            hotelId: 'hotel-london-grand',
            roomId: 'room-ldn-101',
            city: 'London',
            checkIn: '2026-10-01T15:00:00.000Z',
            checkOut: '2026-10-03T11:00:00.000Z',
          },
          {
            type: 'hotel',
            hotelId: 'hotel-edin-castle',
            roomId: 'room-edi-201',
            city: 'Edinburgh',
            checkIn: '2026-10-03T15:00:00.000Z',
            checkOut: '2026-10-05T11:00:00.000Z',
          },
        ],
      };

      const result = (await service.publish(dto)) as {
        id: string;
        flightBookings: unknown[];
        hotelBookings: unknown[];
        steps: Array<{
          flightBookingId: string | null;
          hotelBookingId: string | null;
          stepName: string;
        }>;
      };

      expect(mockGraphService.generate).toHaveBeenCalledWith({
        products: dto.products,
      });

      // Booking no longer carries a JSON products blob.
      expect(mockPrisma.db.orm.public.Booking.create).toHaveBeenCalledWith({
        userId: 'user-123',
        status: 'in_progress',
      });

      // One row per product, in its own typed table.
      expect(
        mockPrisma.db.orm.public.FlightBooking.create,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockPrisma.db.orm.public.HotelBooking.create,
      ).toHaveBeenCalledTimes(2);
      expect(result.flightBookings).toHaveLength(1);
      expect(result.hotelBookings).toHaveLength(2);

      // flight.availability (1 flight) + hotel.availability (2 hotels) +
      // itinerary.fraud (shared) = 4 step rows.
      expect(mockPrisma.db.orm.public.BookingStep.create).toHaveBeenCalledTimes(
        4,
      );
      expect(result.steps).toHaveLength(4);

      const hotelAvailabilitySteps = result.steps.filter(
        (s) => s.stepName === 'hotel.availability',
      );
      expect(hotelAvailabilitySteps).toHaveLength(2);
      expect(hotelAvailabilitySteps[0].flightBookingId).toBeNull();
      expect(hotelAvailabilitySteps[0].hotelBookingId).not.toBeNull();
      expect(hotelAvailabilitySteps[0].hotelBookingId).not.toBe(
        hotelAvailabilitySteps[1].hotelBookingId,
      );

      const flightAvailabilityStep = result.steps.find(
        (s) => s.stepName === 'flight.availability',
      );
      expect(flightAvailabilityStep?.hotelBookingId).toBeNull();
      expect(flightAvailabilityStep?.flightBookingId).not.toBeNull();

      const fraudStep = result.steps.find(
        (s) => s.stepName === 'itinerary.fraud',
      );
      expect(fraudStep?.flightBookingId).toBeNull();
      expect(fraudStep?.hotelBookingId).toBeNull();

      // Only stage-0 steps (flight.availability + the 2 hotel.availability
      // rows) are dispatched; itinerary.fraud is stage 1 and stays out.
      expect(mockDispatchService.dispatchStage0).toHaveBeenCalledTimes(1);
      const dispatchedPairs =
        mockDispatchService.dispatchStage0.mock.calls[0][0];
      expect(dispatchedPairs).toHaveLength(3);
      expect(dispatchedPairs.every((p) => p.generated.stage === 0)).toBe(true);
      expect(dispatchedPairs.map((p) => p.step.stepName).sort()).toEqual([
        'flight.availability',
        'hotel.availability',
        'hotel.availability',
      ]);

      expect(result.id).toBe('booking-uuid-1');
    });
  });

  describe('findById', () => {
    it('should return booking with flight/hotel bookings and ordered steps', async () => {
      const result = (await service.findById('booking-uuid-1')) as {
        id: string;
        flightBookings: unknown[];
        hotelBookings: unknown[];
        steps: Array<{ stepIndex: number }>;
      } | null;

      expect(result).toBeDefined();
      expect(result?.id).toBe('booking-uuid-1');
      expect(result?.flightBookings).toHaveLength(1);
      expect(result?.hotelBookings).toHaveLength(1);
      expect(result?.steps).toHaveLength(2);
      // Steps should be ordered by stepIndex ascending
      expect(result?.steps[0].stepIndex).toBe(0);
      expect(result?.steps[1].stepIndex).toBe(1);
    });

    it('should return null when booking is not found', async () => {
      mockPrisma.db.orm.public.Booking.where.mockReturnValueOnce({
        all: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.findById('non-existent');
      expect(result).toBeNull();
    });
  });
});
