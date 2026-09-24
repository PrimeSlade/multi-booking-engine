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
    service = new StageAdvancementService(
      mockPrisma as never,
      mockGraphService as never,
      mockDispatchService as never,
    );
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

    expect(mockGraphService.generate).not.toHaveBeenCalled();
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

  it('dispatches compensation for a compensatable success step after cancelling', async () => {
    const pendingUpdateAll = jest.fn().mockResolvedValue([]);
    const claimUpdate = jest.fn().mockResolvedValue({
      id: 'step-allotment',
      bookingId: 'booking-1',
      stepName: 'flight.allotment',
      scope: 'product',
      agent: 'flight-agent',
      flightBookingId: 'flight-booking-1',
      hotelBookingId: null,
    });
    mockPrisma.db.orm.public.BookingStep.where
      .mockReturnValueOnce(whereAll([{ ...completedStep, status: 'failed' }]))
      .mockReturnValueOnce({ updateAll: pendingUpdateAll })
      .mockReturnValueOnce(
        whereAll([
          {
            id: 'step-allotment',
            bookingId: 'booking-1',
            stepName: 'flight.allotment',
            scope: 'product',
            agent: 'flight-agent',
            flightBookingId: 'flight-booking-1',
            hotelBookingId: null,
            status: 'success',
          },
        ]),
      )
      .mockReturnValueOnce({ update: claimUpdate });
    const bookingUpdate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });
    mockGraphService.generate.mockReturnValue({
      stages: [],
      steps: [
        { stepName: 'flight.allotment', compensate: 'release_seat' },
        { stepName: 'itinerary.fraud' },
      ],
    });

    await service.maybeAdvance({ ...completedStep, status: 'failed' } as never);

    expect(mockPrisma.db.orm.public.BookingStep.where).toHaveBeenNthCalledWith(
      4,
      { id: 'step-allotment', status: 'success' },
    );
    expect(claimUpdate).toHaveBeenCalledWith({ status: 'compensating' });
    expect(mockDispatchService.dispatchCompensations).toHaveBeenCalledWith([
      {
        id: 'step-allotment',
        bookingId: 'booking-1',
        stepName: 'flight.allotment',
        scope: 'product',
        agent: 'flight-agent',
        flightBookingId: 'flight-booking-1',
        hotelBookingId: null,
        status: 'success',
      },
    ]);
  });

  it('does not compensate a success step with no compensate action defined', async () => {
    const pendingUpdateAll = jest.fn().mockResolvedValue([]);
    mockPrisma.db.orm.public.BookingStep.where
      .mockReturnValueOnce(whereAll([{ ...completedStep, status: 'failed' }]))
      .mockReturnValueOnce({ updateAll: pendingUpdateAll })
      .mockReturnValueOnce(
        whereAll([
          {
            ...completedStep,
            id: 'step-fraud',
            stepName: 'itinerary.fraud',
            status: 'success',
          },
        ]),
      );
    const bookingUpdate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });
    mockGraphService.generate.mockReturnValue({
      stages: [],
      steps: [{ stepName: 'flight.allotment', compensate: 'release_seat' }],
    });

    await service.maybeAdvance({ ...completedStep, status: 'failed' } as never);

    expect(mockDispatchService.dispatchCompensations).not.toHaveBeenCalled();
  });

  it('does not dispatch compensation when the claim loses the race', async () => {
    const pendingUpdateAll = jest.fn().mockResolvedValue([]);
    const claimUpdate = jest.fn().mockResolvedValue(null);
    mockPrisma.db.orm.public.BookingStep.where
      .mockReturnValueOnce(whereAll([{ ...completedStep, status: 'failed' }]))
      .mockReturnValueOnce({ updateAll: pendingUpdateAll })
      .mockReturnValueOnce(
        whereAll([
          {
            id: 'step-allotment',
            bookingId: 'booking-1',
            stepName: 'flight.allotment',
            status: 'success',
          },
        ]),
      )
      .mockReturnValueOnce({ update: claimUpdate });
    const bookingUpdate = jest.fn().mockResolvedValue({ id: 'booking-1' });
    mockPrisma.db.orm.public.Booking.where.mockReturnValue({
      update: bookingUpdate,
    });
    mockGraphService.generate.mockReturnValue({
      stages: [],
      steps: [{ stepName: 'flight.allotment', compensate: 'release_seat' }],
    });

    await service.maybeAdvance({ ...completedStep, status: 'failed' } as never);

    expect(mockDispatchService.dispatchCompensations).not.toHaveBeenCalled();
  });
});
