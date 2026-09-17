jest.mock('@nestjs/config', () => ({
  ConfigService: class MockConfigService {
    get() {
      return undefined;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { GraphService } from './graph.service';
import bookingGraphConfig from './config/booking-graph.config';
import { GenerateGraphInput } from './types';

describe('GraphService', () => {
  let service: GraphService;
  const mockBookingGraph = bookingGraphConfig().bookingGraph;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'bookingGraph') {
                return mockBookingGraph;
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GraphService>(GraphService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate for flight-only itinerary', () => {
    it('should generate steps filtered to flight and shared itinerary steps', () => {
      const graph = service.generate({ products: ['flight'] });

      expect(graph.version).toBe(1);
      expect(graph.onPartialFailure).toBe('awaiting_user_decision');
      expect(graph.decisionTtlMs).toBe(900000);
      expect(graph.onDecisionTimeout).toBe('reject_all_and_compensate');

      expect(graph.steps).toHaveLength(5);
      expect(graph.steps.map((s) => s.stepName)).toEqual([
        'flight.availability',
        'itinerary.fraud',
        'flight.allotment',
        'itinerary.payment',
        'itinerary.notify',
      ]);

      // Flight availability
      const flightAvail = graph.steps[0];
      expect(flightAvail.stage).toBe(0);
      expect(flightAvail.scope).toBe('product');
      expect(flightAvail.product).toBe('flight');
      expect(flightAvail.agent).toBe('flight-agent');
      expect(flightAvail.routingKey).toBe('booking.step.flight.availability');
      expect(flightAvail.timeoutMs).toBe(5000);
      expect(flightAvail.retry).toEqual({ max: 3, backoffMs: 1000 });
      expect(flightAvail.compensate).toBeUndefined();

      // Fraud check
      const fraud = graph.steps[1];
      expect(fraud.stage).toBe(1);
      expect(fraud.scope).toBe('itinerary');
      expect(fraud.product).toBeNull();
      expect(fraud.agent).toBe('fraud-agent');
      expect(fraud.routingKey).toBe('booking.step.itinerary.fraud');

      // Flight allotment (with compensation)
      const flightAllot = graph.steps[2];
      expect(flightAllot.stage).toBe(2);
      expect(flightAllot.scope).toBe('product');
      expect(flightAllot.product).toBe('flight');
      expect(flightAllot.compensate).toBe('release_seat');

      // Payment (with refund compensation)
      const payment = graph.steps[3];
      expect(payment.stage).toBe(3);
      expect(payment.scope).toBe('itinerary');
      expect(payment.compensate).toBe('refund_payment');

      // Stages
      expect(graph.stages).toHaveLength(5);
      expect(graph.stages[0].policy).toBe('parallel');
      expect(graph.stages[0].steps).toHaveLength(1);
    });
  });

  describe('generate for hotel-only itinerary', () => {
    it('should generate steps filtered to hotel and shared itinerary steps', () => {
      const graph = service.generate({ products: ['hotel'] });

      expect(graph.steps).toHaveLength(5);
      expect(graph.steps.map((s) => s.stepName)).toEqual([
        'hotel.availability',
        'itinerary.fraud',
        'hotel.allotment',
        'itinerary.payment',
        'itinerary.notify',
      ]);

      const hotelAllot = graph.steps[2];
      expect(hotelAllot.scope).toBe('product');
      expect(hotelAllot.product).toBe('hotel');
      expect(hotelAllot.compensate).toBe('release_room');
    });
  });

  describe('generate for multi-product itinerary (flight + hotel)', () => {
    it('should include all product steps and shared steps in stage order', () => {
      const graph = service.generate({ products: ['flight', 'hotel'] });

      expect(graph.steps).toHaveLength(7);
      expect(graph.steps.map((s) => s.stepName)).toEqual([
        'flight.availability',
        'hotel.availability',
        'itinerary.fraud',
        'flight.allotment',
        'hotel.allotment',
        'itinerary.payment',
        'itinerary.notify',
      ]);

      // Stage 0 (parallel) has both availability steps
      expect(graph.stages[0].steps).toHaveLength(2);
      // Stage 2 (parallel, all_or_ask) has both allotment steps
      expect(graph.stages[2].steps).toHaveLength(2);
      expect(graph.stages[2].join).toBe('all_or_ask');
    });
  });

  describe('two hotels + one flight support', () => {
    it('should handle multiple items of the same product type by deduplicating and generating full graph', () => {
      const dto: GenerateGraphInput = {
        products: [{ type: 'hotel' }, { type: 'hotel' }, { type: 'flight' }],
      };

      const graph = service.generate(dto);

      // Recognizes both hotel and flight, generates 7 unique steps
      expect(graph.steps).toHaveLength(7);
      expect(graph.steps.map((s) => s.stepName)).toEqual([
        'flight.availability',
        'hotel.availability',
        'itinerary.fraud',
        'flight.allotment',
        'hotel.allotment',
        'itinerary.payment',
        'itinerary.notify',
      ]);
    });
  });

  describe('validation and error handling', () => {
    it('should throw BadRequestException when products array is empty', () => {
      expect(() => service.generate({ products: [] })).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when unsupported product is passed', () => {
      expect(() => service.generate({ products: ['car'] })).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when graph config is missing', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GraphService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
        ],
      }).compile();

      const brokenService = module.get<GraphService>(GraphService);
      expect(() => brokenService.generate({ products: ['flight'] })).toThrow(
        BadRequestException,
      );
    });
  });
});
