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
          Booking: { where: jest.Mock };
          BookingStep: { where: jest.Mock };
          FlightBooking: { where: jest.Mock };
          HotelBooking: { where: jest.Mock };
        };
      };
    };
  };
  let mockGraphService: { generate: jest.Mock };
  let mockDispatchService: {
    dispatchSteps: jest.Mock;
    dispatchCompensations: jest.Mock;
  };
  let mockCompensationService: { compensateSuccessfulSteps: jest.Mock };
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
            Booking: { where: jest.fn() },
            BookingStep: { where: jest.fn() },
            FlightBooking: { where: jest.fn().mockReturnValue(whereAll([])) },
            HotelBooking: { where: jest.fn().mockReturnValue(whereAll([])) },
          },
        },
      },
    };
    mockGraphService = {
      generate: jest.fn().mockReturnValue({ stages: [], steps: [] }),
    };
    mockDispatchService = {
      dispatchSteps: jest.fn().mockResolvedValue(undefined),
      dispatchCompensations: jest.fn().mockResolvedValue(undefined),
    };
    mockCompensationService = {
      compensateSuccessfulSteps: jest.fn().mockResolvedValue(undefined),
    };
    service = new StageAdvancementService(
      mockPrisma as never,
      mockGraphService as never,
      mockDispatchService as never,
      mockCompensationService as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels the booking when the triggering step itself failed', async () => {
    mockPrisma.db.orm.public.BookingStep.where
      .mockReturnValueOnce(whereAll([{ ...completedStep, status: 'failed' }]))
      .mockReturnValueOnce({
        updateAll: jest.fn().mockResolvedValue([]),
      });
    const bookingUpdate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });

    await service.maybeAdvance({ ...completedStep, status: 'failed' } as never);

    expect(mockPrisma.db.orm.public.Booking.where).toHaveBeenCalledWith({
      id: 'booking-1',
      status: 'in_progress',
    });
    expect(bookingUpdate).toHaveBeenCalledWith({ status: 'failed' });
    expect(mockDispatchService.dispatchSteps).not.toHaveBeenCalled();
    expect(mockDispatchService.dispatchCompensations).not.toHaveBeenCalled();
  });

  it('does not cancel again when the booking was already cancelled', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValueOnce(
      whereAll([{ ...completedStep, status: 'failed' }]),
    );
    const bookingUpdate = jest.fn().mockResolvedValue(null);
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });

    await service.maybeAdvance({ ...completedStep, status: 'failed' } as never);

    expect(bookingUpdate).toHaveBeenCalledTimes(1);
    // Only the stage-lookup call happened - no second BookingStep.where for
    // the bulk-cancel updateAll, since the booking-level claim lost the race.
    expect(mockPrisma.db.orm.public.BookingStep.where).toHaveBeenCalledTimes(1);
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

    expect(mockGraphService.generate).toHaveBeenCalledWith({ products: [] });
    expect(mockDispatchService.dispatchSteps).not.toHaveBeenCalled();
  });

  it('cancels the booking when a sibling step already failed', async () => {
    const cancelStepsUpdateAll = jest.fn().mockResolvedValue([]);
    mockPrisma.db.orm.public.BookingStep.where
      .mockReturnValueOnce(
        whereAll([
          { ...completedStep, status: 'success' },
          {
            ...completedStep,
            id: 'step-2',
            stepName: 'hotel.availability',
            status: 'failed',
          },
        ]),
      )
      .mockReturnValueOnce({ updateAll: cancelStepsUpdateAll });
    const bookingUpdate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });

    await service.maybeAdvance(completedStep as never);

    expect(bookingUpdate).toHaveBeenCalledWith({ status: 'failed' });
    expect(cancelStepsUpdateAll).toHaveBeenCalledWith({
      status: 'failed',
      error: { code: 'BOOKING_CANCELLED', retryable: false },
    });
    // generate() IS called (compensateSuccessfulSteps looks up compensatable
    // steps), but the default mock returns no compensatable steps, so
    // nothing gets dispatched - either kind.
    expect(mockDispatchService.dispatchSteps).not.toHaveBeenCalled();
    expect(mockDispatchService.dispatchCompensations).not.toHaveBeenCalled();
  });

  it('confirms the booking when the completed stage was the last one', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValueOnce(
      whereAll([{ ...completedStep, status: 'success' }]),
    );
    mockPrisma.db.orm.public.FlightBooking.where.mockReturnValue(
      whereAll([{ id: 'flight-booking-1' }]),
    );
    mockGraphService.generate.mockReturnValue({
      stages: [{ stage: 0, policy: 'parallel', steps: [] }],
    });
    const bookingUpdate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });

    await service.maybeAdvance(completedStep as never);

    expect(mockPrisma.db.orm.public.Booking.where).toHaveBeenCalledWith({
      id: 'booking-1',
      status: 'in_progress',
    });
    expect(bookingUpdate).toHaveBeenCalledWith({ status: 'confirmed' });
    expect(mockDispatchService.dispatchSteps).not.toHaveBeenCalled();
  });

  it('does not overwrite a booking that already left in_progress', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValueOnce(
      whereAll([{ ...completedStep, status: 'success' }]),
    );
    mockGraphService.generate.mockReturnValue({
      stages: [{ stage: 0, policy: 'parallel', steps: [] }],
    });
    const bookingUpdate = jest.fn().mockResolvedValue(null);
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });

    await service.maybeAdvance(completedStep as never);

    expect(bookingUpdate).toHaveBeenCalledWith({ status: 'confirmed' });
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

  it('requests compensation after cancelling a failed booking', async () => {
    const pendingUpdateAll = jest.fn().mockResolvedValue([]);
    mockPrisma.db.orm.public.BookingStep.where
      .mockReturnValueOnce(whereAll([{ ...completedStep, status: 'failed' }]))
      .mockReturnValueOnce({ updateAll: pendingUpdateAll });
    const bookingUpdate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });

    await service.maybeAdvance({ ...completedStep, status: 'failed' } as never);

    expect(
      mockCompensationService.compensateSuccessfulSteps,
    ).toHaveBeenCalledWith('booking-1');
  });

  it('pauses a settled mixed all_or_ask stage for a user decision', async () => {
    const now = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValueOnce(
      whereAll([
        { ...completedStep, stage: 2, status: 'success' },
        { ...completedStep, id: 'step-2', stage: 2, status: 'failed' },
      ]),
    );
    mockGraphService.generate.mockReturnValue({
      decisionTtlMs: 900_000,
      stages: [{ stage: 2, join: 'all_or_ask', steps: [] }],
    });
    const bookingUpdate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });

    await service.maybeAdvance({ ...completedStep, stage: 2 } as never);

    expect(bookingUpdate).toHaveBeenCalledWith({
      status: 'awaiting_user_decision',
      decisionExpiresAt: new Date(now + 900_000).toISOString(),
    });
    expect(
      mockCompensationService.compensateSuccessfulSteps,
    ).not.toHaveBeenCalled();
    expect(mockDispatchService.dispatchSteps).not.toHaveBeenCalled();
  });

  it('waits for every all_or_ask sibling before requesting a decision', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValueOnce(
      whereAll([
        { ...completedStep, stage: 2, status: 'failed' },
        { ...completedStep, id: 'step-2', stage: 2, status: 'in_progress' },
      ]),
    );
    mockGraphService.generate.mockReturnValue({
      decisionTtlMs: 900_000,
      stages: [{ stage: 2, join: 'all_or_ask', steps: [] }],
    });

    await service.maybeAdvance({ ...completedStep, stage: 2 } as never);

    expect(mockPrisma.db.orm.public.Booking.where).not.toHaveBeenCalled();
    expect(
      mockCompensationService.compensateSuccessfulSteps,
    ).not.toHaveBeenCalled();
  });

  it('cancels when every all_or_ask step failed', async () => {
    mockPrisma.db.orm.public.BookingStep.where
      .mockReturnValueOnce(
        whereAll([
          { ...completedStep, stage: 2, status: 'failed' },
          { ...completedStep, id: 'step-2', stage: 2, status: 'failed' },
        ]),
      )
      .mockReturnValueOnce({ updateAll: jest.fn().mockResolvedValue([]) });
    mockGraphService.generate.mockReturnValue({
      decisionTtlMs: 900_000,
      stages: [{ stage: 2, join: 'all_or_ask', steps: [] }],
    });
    const bookingUpdate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });

    await service.maybeAdvance({ ...completedStep, stage: 2 } as never);

    expect(bookingUpdate).toHaveBeenCalledWith({ status: 'failed' });
    expect(
      mockCompensationService.compensateSuccessfulSteps,
    ).toHaveBeenCalledWith('booking-1');
  });

  it('resumes after acceptance by claiming and dispatching the next stage', async () => {
    const claimed = [
      {
        id: 'payment-step',
        bookingId: 'booking-1',
        stepName: 'payment.charge',
      },
    ];
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValueOnce({
      updateAll: jest.fn().mockResolvedValue(claimed),
    });
    const paymentStep = {
      stage: 3,
      stepName: 'payment.charge',
      routingKey: 'booking.step.payment.charge',
    };
    mockGraphService.generate.mockReturnValue({
      stages: [
        { stage: 2, join: 'all_or_ask', steps: [] },
        {
          stage: 3,
          steps: [paymentStep],
        },
      ],
    });

    await service.resumeAfterDecision('booking-1');

    expect(mockDispatchService.dispatchSteps).toHaveBeenCalledWith([
      { step: claimed[0], generated: paymentStep },
    ]);
  });

  it('finalizes an accepted mixed booking as partially_confirmed', async () => {
    mockPrisma.db.orm.public.BookingStep.where
      .mockReturnValueOnce(whereAll([{ ...completedStep, stage: 4 }]))
      .mockReturnValueOnce(
        whereAll([
          { ...completedStep, stage: 2, status: 'success' },
          { ...completedStep, id: 'step-2', stage: 2, status: 'failed' },
        ]),
      );
    mockGraphService.generate.mockReturnValue({
      stages: [
        { stage: 2, join: 'all_or_ask', steps: [] },
        { stage: 4, steps: [] },
      ],
    });
    const bookingUpdate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });

    await service.maybeAdvance({ ...completedStep, stage: 4 } as never);

    expect(bookingUpdate).toHaveBeenCalledWith({
      status: 'partially_confirmed',
    });
  });
});
