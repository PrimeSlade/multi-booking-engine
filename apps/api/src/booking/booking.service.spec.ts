jest.mock('@nestjs/config', () => ({
  ConfigService: class MockConfigService {},
}));

jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { PrismaService } from '@/prisma/prisma.service';
import { GraphService } from '@/graph/graph.service';
import { PublishBookingDto } from './dto/publish-booking.dto';

describe('BookingService', () => {
  let service: BookingService;

  const mockCreatedBooking = {
    id: 'booking-uuid-1',
    userId: 'user-123',
    status: 'in_progress',
    products: { graphVersion: 1, items: [] },
  };

  const mockCreatedStep = {
    id: 'step-uuid-1',
    bookingId: 'booking-uuid-1',
    stepIndex: 0,
    stage: 0,
    stepName: 'flight.availability',
    scope: 'product',
    product: 'flight',
    agent: 'flight-agent',
    status: 'pending',
    attempt: 0,
  };

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
                toArray: jest.fn().mockResolvedValue([
                  {
                    ...mockCreatedStep,
                    stepIndex: 1,
                    stage: 1,
                    stepName: 'itinerary.fraud',
                  },
                  {
                    ...mockCreatedStep,
                    stepIndex: 0,
                    stage: 0,
                    stepName: 'flight.availability',
                  },
                ]),
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
          stepIndex: 0,
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
          stepIndex: 1,
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GraphService, useValue: mockGraphService },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should generate graph and create booking along with its steps', async () => {
      const dto: PublishBookingDto = {
        userId: 'user-123',
        products: [
          {
            type: 'flight',
            flightId: 'flight-ba-178',
            flightNumber: 'BA178',
            airlineName: 'British Airways',
            origin: 'NYC',
            destination: 'LAX',
            departureDate: '2026-10-01T00:00:00.000Z',
          },
        ],
      };

      const result = (await service.publish(dto)) as {
        id: string;
        steps: unknown[];
      };

      expect(mockGraphService.generate).toHaveBeenCalledWith({
        products: dto.products,
      });

      expect(mockPrisma.db.orm.public.Booking.create).toHaveBeenCalledWith({
        userId: 'user-123',
        status: 'in_progress',
        products: {
          graphVersion: 1,
          items: [
            {
              type: 'flight',
              flightId: 'flight-ba-178',
              flightNumber: 'BA178',
              airlineName: 'British Airways',
              origin: 'NYC',
              destination: 'LAX',
              departureDate: '2026-10-01T00:00:00.000Z',
            },
          ],
        },
      });

      // Verify that BookingStep.create was called for each generated step
      expect(mockPrisma.db.orm.public.BookingStep.create).toHaveBeenCalledTimes(
        2,
      );
      expect(result.steps).toHaveLength(2);
      expect(result.id).toBe('booking-uuid-1');
    });
  });

  describe('findById', () => {
    it('should return booking with ordered steps', async () => {
      const result = (await service.findById('booking-uuid-1')) as {
        id: string;
        steps: Array<{ stepIndex: number }>;
      } | null;

      expect(result).toBeDefined();
      expect(result?.id).toBe('booking-uuid-1');
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
