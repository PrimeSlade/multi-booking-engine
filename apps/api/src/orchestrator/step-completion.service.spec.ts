jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { StepCompletionService } from './step-completion.service';

describe('StepCompletionService', () => {
  let mockPrisma: {
    db: { orm: { public: { BookingStep: { where: jest.Mock } } } };
  };
  let service: StepCompletionService;

  const mockUpdate = (value: unknown) => ({
    update: jest.fn().mockResolvedValue(value),
  });

  beforeEach(() => {
    mockPrisma = {
      db: { orm: { public: { BookingStep: { where: jest.fn() } } } },
    };
    service = new StepCompletionService(mockPrisma as never);
  });

  it('writes status/result/error for a success completion', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValue(
      mockUpdate({ id: 'step-1' }),
    );

    await service.applyCompletion({
      stepId: 'step-1',
      bookingId: 'booking-1',
      stepName: 'flight.availability',
      scope: 'product',
      agent: 'flight-agent',
      flightBookingId: 'fb-1',
      hotelBookingId: null,
      attempt: 0,
      status: 'success',
      result: { seatsLeft: 5 },
      error: null,
    });

    expect(mockPrisma.db.orm.public.BookingStep.where).toHaveBeenCalledWith({
      id: 'step-1',
    });
    const whereResult = mockPrisma.db.orm.public.BookingStep.where.mock
      .results[0].value as { update: jest.Mock };
    expect(whereResult.update).toHaveBeenCalledWith({
      status: 'success',
      result: { seatsLeft: 5 },
      error: null,
      retryable: null,
    });
  });

  it('writes retryable from the error for a failed completion', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValue(
      mockUpdate({ id: 'step-1' }),
    );

    await service.applyCompletion({
      stepId: 'step-1',
      bookingId: 'booking-1',
      stepName: 'flight.availability',
      scope: 'product',
      agent: 'flight-agent',
      flightBookingId: 'fb-1',
      hotelBookingId: null,
      attempt: 0,
      status: 'failed',
      error: { code: 'NO_AVAILABILITY', retryable: false },
    });

    const whereResult = mockPrisma.db.orm.public.BookingStep.where.mock
      .results[0].value as { update: jest.Mock };
    expect(whereResult.update).toHaveBeenCalledWith({
      status: 'failed',
      result: null,
      error: { code: 'NO_AVAILABILITY', retryable: false },
      retryable: false,
    });
  });

  it('logs a warning and does not throw when no row matches', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValue(
      mockUpdate(null),
    );

    await expect(
      service.applyCompletion({
        stepId: 'missing-step',
        bookingId: 'booking-1',
        stepName: 'flight.availability',
        scope: 'product',
        agent: 'flight-agent',
        flightBookingId: 'fb-1',
        hotelBookingId: null,
        attempt: 0,
        status: 'success',
        result: { seatsLeft: 5 },
        error: null,
      }),
    ).resolves.toBeNull();
  });
});
