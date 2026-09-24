jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { StepCompensationService } from './step-compensation.service';

describe('StepCompensationService', () => {
  let mockPrisma: {
    db: { orm: { public: { BookingStep: { where: jest.Mock } } } };
  };
  let service: StepCompensationService;

  const mockUpdate = (value: unknown) => ({
    update: jest.fn().mockResolvedValue(value),
  });

  beforeEach(() => {
    mockPrisma = {
      db: { orm: { public: { BookingStep: { where: jest.fn() } } } },
    };
    service = new StepCompensationService(mockPrisma as never);
  });

  it('marks the step compensated when the claim succeeds', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValue(
      mockUpdate({ id: 'step-1', status: 'compensated' }),
    );

    const result = await service.applyCompensated({
      stepId: 'step-1',
      bookingId: 'booking-1',
      stepName: 'flight.allotment',
    });

    expect(mockPrisma.db.orm.public.BookingStep.where).toHaveBeenCalledWith({
      id: 'step-1',
      status: 'compensating',
    });
    const whereResult = mockPrisma.db.orm.public.BookingStep.where.mock
      .results[0].value as { update: jest.Mock };
    expect(whereResult.update).toHaveBeenCalledWith({
      status: 'compensated',
    });
    expect(result).toEqual({ id: 'step-1', status: 'compensated' });
  });

  it('logs a warning and does not throw when no compensating row matches', async () => {
    mockPrisma.db.orm.public.BookingStep.where.mockReturnValue(
      mockUpdate(null),
    );

    await expect(
      service.applyCompensated({
        stepId: 'missing-step',
        bookingId: 'booking-1',
        stepName: 'flight.allotment',
      }),
    ).resolves.toBeNull();
  });
});
