jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: class MockConfigService {},
}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookingDecisionService } from './booking-decision.service';

describe('BookingDecisionService', () => {
  let bookingWhere: jest.Mock;
  let bookingStepWhere: jest.Mock;
  let resumeAfterDecision: jest.Mock;
  let compensateSuccessfulSteps: jest.Mock;
  let service: BookingDecisionService;

  const whereAll = (rows: unknown[]) => ({
    all: jest.fn().mockReturnValue({
      first: jest.fn().mockResolvedValue(rows[0] ?? null),
      toArray: jest.fn().mockResolvedValue(rows),
    }),
  });

  beforeEach(() => {
    bookingWhere = jest.fn();
    bookingStepWhere = jest.fn();
    resumeAfterDecision = jest.fn().mockResolvedValue(undefined);
    compensateSuccessfulSteps = jest.fn().mockResolvedValue(undefined);
    service = new BookingDecisionService(
      {
        db: {
          orm: {
            public: {
              Booking: { where: bookingWhere },
              BookingStep: { where: bookingStepWhere },
            },
          },
        },
      } as never,
      { resumeAfterDecision } as never,
      { compensateSuccessfulSteps } as never,
    );
  });

  it('accepts a partial booking and resumes the saga', async () => {
    const accepted = { id: 'booking-1', status: 'in_progress' };
    bookingWhere
      .mockReturnValueOnce(
        whereAll([{ id: 'booking-1', status: 'awaiting_user_decision' }]),
      )
      .mockReturnValueOnce({
        update: jest.fn().mockResolvedValue(accepted),
      });

    await expect(service.decide('booking-1', 'accept_partial')).resolves.toBe(
      accepted,
    );

    expect(bookingWhere).toHaveBeenLastCalledWith({
      id: 'booking-1',
      status: 'awaiting_user_decision',
    });
    expect(resumeAfterDecision).toHaveBeenCalledWith('booking-1');
    expect(compensateSuccessfulSteps).not.toHaveBeenCalled();
  });

  it('rejects the partial booking and compensates successful steps', async () => {
    const rejected = { id: 'booking-1', status: 'failed' };
    bookingWhere
      .mockReturnValueOnce(
        whereAll([{ id: 'booking-1', status: 'awaiting_user_decision' }]),
      )
      .mockReturnValueOnce({ update: jest.fn().mockResolvedValue(rejected) });
    const updateAll = jest.fn().mockResolvedValue([]);
    bookingStepWhere.mockReturnValue({ updateAll });

    await expect(service.decide('booking-1', 'reject_all')).resolves.toBe(
      rejected,
    );

    expect(updateAll).toHaveBeenCalledWith({
      status: 'failed',
      error: { code: 'PARTIAL_BOOKING_REJECTED', retryable: false },
    });
    expect(compensateSuccessfulSteps).toHaveBeenCalledWith('booking-1');
    expect(resumeAfterDecision).not.toHaveBeenCalled();
  });

  it('expires an overdue decision instead of accepting it', async () => {
    bookingWhere
      .mockReturnValueOnce(
        whereAll([
          {
            id: 'booking-1',
            status: 'awaiting_user_decision',
            decisionExpiresAt: '2000-01-01T00:00:00.000Z',
          },
        ]),
      )
      .mockReturnValueOnce({
        update: jest.fn().mockResolvedValue({ id: 'booking-1' }),
      });
    bookingStepWhere.mockReturnValue({
      updateAll: jest.fn().mockResolvedValue([]),
    });

    await expect(service.decide('booking-1', 'accept_partial')).rejects.toThrow(
      ConflictException,
    );

    expect(compensateSuccessfulSteps).toHaveBeenCalledWith('booking-1');
    expect(resumeAfterDecision).not.toHaveBeenCalled();
  });

  it('expires only overdue waiting bookings during a sweep', async () => {
    bookingWhere
      .mockReturnValueOnce(
        whereAll([
          {
            id: 'expired',
            decisionExpiresAt: '2000-01-01T00:00:00.000Z',
          },
          {
            id: 'future',
            decisionExpiresAt: '2999-01-01T00:00:00.000Z',
          },
        ]),
      )
      .mockReturnValueOnce({
        update: jest.fn().mockResolvedValue({ id: 'expired' }),
      });
    bookingStepWhere.mockReturnValue({
      updateAll: jest.fn().mockResolvedValue([]),
    });

    await expect(service.expireDueDecisions()).resolves.toBe(1);

    expect(bookingWhere).toHaveBeenCalledTimes(2);
    expect(compensateSuccessfulSteps).toHaveBeenCalledWith('expired');
  });

  it('reports missing and already resolved bookings', async () => {
    bookingWhere.mockReturnValueOnce(whereAll([]));
    await expect(service.decide('missing', 'reject_all')).rejects.toThrow(
      NotFoundException,
    );

    bookingWhere.mockReturnValueOnce(
      whereAll([{ id: 'booking-1', status: 'confirmed' }]),
    );
    await expect(service.decide('booking-1', 'reject_all')).rejects.toThrow(
      ConflictException,
    );
  });
});
