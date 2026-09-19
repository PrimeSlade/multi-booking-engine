jest.mock('@nestjs/config', () => ({
  ConfigService: class MockConfigService {},
}));

jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { StageAdvancementService } from './stage-advancement.service';

describe('StageAdvancementService', () => {
  let mockPrisma: {
    db: {
      orm: {
        public: {
          BookingStep: { where: jest.Mock };
          FlightBooking: { where: jest.Mock };
          HotelBooking: { where: jest.Mock };
        };
      };
    };
  };
  let mockGraphService: { generate: jest.Mock };
  let mockDispatchService: { dispatchSteps: jest.Mock };
  let service: StageAdvancementService;

  // The real type is the full Prisma-generated BookingStep row (inferred
  // from applyCompletion's return type), but the service only reads
  // id/bookingId/stepName/stage/status off it, so this narrow fixture is
  // enough - cast at each call site below since the service param isn't
  // exported as a standalone type.
  const completedStep = {
    id: 'step-1',
    bookingId: 'booking-1',
    stepName: 'flight.availability',
    stage: 0,
    status: 'success' as const,
  };

  const whereAll = (rows: unknown[]) => ({
    all: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue(rows),
    }),
  });

  beforeEach(() => {
    mockPrisma = {
      db: {
        orm: {
          public: {
            BookingStep: { where: jest.fn() },
            FlightBooking: { where: jest.fn().mockReturnValue(whereAll([])) },
            HotelBooking: { where: jest.fn().mockReturnValue(whereAll([])) },
          },
        },
      },
    };
    mockGraphService = { generate: jest.fn() };
    mockDispatchService = {
      dispatchSteps: jest.fn().mockResolvedValue(undefined),
    };
    service = new StageAdvancementService(
      mockPrisma as never,
      mockGraphService as never,
      mockDispatchService as never,
    );
  });

  it('does nothing for a failed completion', async () => {
    await service.maybeAdvance({ ...completedStep, status: 'failed' } as never);

    expect(mockPrisma.db.orm.public.BookingStep.where).not.toHaveBeenCalled();
  });

  it('does not advance while a sibling step is still pending', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValueOnce(
      whereAll([
        { ...completedStep, status: 'success' },
        {
          ...completedStep,
          id: 'step-2',
          stepName: 'hotel.availability',
          status: 'pending',
        },
      ]),
    );

    await service.maybeAdvance(completedStep as never);

    expect(mockGraphService.generate).not.toHaveBeenCalled();
    expect(mockDispatchService.dispatchSteps).not.toHaveBeenCalled();
  });

  it('does not advance when a sibling step failed', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValueOnce(
      whereAll([
        { ...completedStep, status: 'success' },
        {
          ...completedStep,
          id: 'step-2',
          stepName: 'hotel.availability',
          status: 'failed',
        },
      ]),
    );

    await service.maybeAdvance(completedStep as never);

    expect(mockDispatchService.dispatchSteps).not.toHaveBeenCalled();
  });

  it('does nothing when the completed stage was the last one in the graph', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValueOnce(
      whereAll([{ ...completedStep, status: 'success' }]),
    );
    mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
      whereAll([{ id: 'flight-booking-1' }]),
    );
    mockGraphService.generate.mockReturnValue({
      stages: [{ stage: 0, policy: 'parallel', steps: [] }],
    });

    await service.maybeAdvance(completedStep as never);

    expect(mockDispatchService.dispatchSteps).not.toHaveBeenCalled();
  });

  it('claims and dispatches the next stage once every step in the current stage succeeds', async () => {
    const updateAll = jest
      .fn()
      .mockResolvedValue([
        { id: 'step-2', bookingId: 'booking-1', stepName: 'itinerary.fraud' },
      ]);
    mockPrisma.db.orm.public.BookingStep.where
      .mockReturnValueOnce(whereAll([{ ...completedStep, status: 'success' }]))
      .mockReturnValueOnce({ updateAll });
    mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
      whereAll([{ id: 'flight-booking-1' }]),
    );

    const nextStep = {
      stage: 1,
      stepName: 'itinerary.fraud',
      routingKey: 'booking.step.itinerary.fraud',
    };
    mockGraphService.generate.mockReturnValue({
      stages: [
        { stage: 0, policy: 'parallel', steps: [] },
        { stage: 1, policy: 'sequential', steps: [nextStep] },
      ],
    });

    await service.maybeAdvance(completedStep as never);

    expect(mockGraphService.generate).toHaveBeenCalledWith({
      products: ['flight'],
    });
    expect(updateAll).toHaveBeenCalledWith({ status: 'in_progress' });
    expect(mockDispatchService.dispatchSteps).toHaveBeenCalledWith([
      {
        step: {
          id: 'step-2',
          bookingId: 'booking-1',
          stepName: 'itinerary.fraud',
        },
        generated: nextStep,
      },
    ]);
  });

  it('skips dispatch when another completion already claimed the next stage', async () => {
    const updateAll = jest.fn().mockResolvedValue([]);
    mockPrisma.db.orm.public.BookingStep.where
      .mockReturnValueOnce(whereAll([{ ...completedStep, status: 'success' }]))
      .mockReturnValueOnce({ updateAll });
    mockGraphService.generate.mockReturnValue({
      stages: [
        { stage: 0, policy: 'parallel', steps: [] },
        {
          stage: 1,
          policy: 'sequential',
          steps: [{ stage: 1, stepName: 'itinerary.fraud' }],
        },
      ],
    });

    await service.maybeAdvance(completedStep as never);

    expect(mockDispatchService.dispatchSteps).not.toHaveBeenCalled();
  });
});
