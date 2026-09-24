jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { FraudService } from './fraud.service';

describe('FraudService', () => {
  let mockPrisma: {
    db: {
      orm: {
        public: {
          Booking: { where: jest.Mock };
          FraudBlacklist: { where: jest.Mock };
        };
      };
    };
  };
  let service: FraudService;

  const mockFirst = (value: unknown) => ({
    all: jest.fn().mockReturnValue({
      first: jest.fn().mockResolvedValue(value),
    }),
  });

  beforeEach(() => {
    mockPrisma = {
      db: {
        orm: {
          public: {
            Booking: { where: jest.fn() },
            FraudBlacklist: { where: jest.fn() },
          },
        },
      },
    };
    service = new FraudService(mockPrisma as never);
  });

  it('returns true when the booking user is blacklisted', async () => {
    mockPrisma.db.orm.public.Booking.where.mockReturnValue(
      mockFirst({ id: 'booking-1', userId: 'ok@email.com' }),
    );
    mockPrisma.db.orm.public.FraudBlacklist.where.mockReturnValue(
      mockFirst({ userId: 'ok@email.com' }),
    );

    const result = await service.checkFraud('booking-1');

    expect(result).toBe(true);
    expect(mockPrisma.db.orm.public.FraudBlacklist.where).toHaveBeenCalledWith({
      userId: 'ok@email.com',
    });
  });

  it('returns false when the booking user is not blacklisted', async () => {
    mockPrisma.db.orm.public.Booking.where.mockReturnValue(
      mockFirst({ id: 'booking-1', userId: 'safe-user' }),
    );
    mockPrisma.db.orm.public.FraudBlacklist.where.mockReturnValue(
      mockFirst(null),
    );

    const result = await service.checkFraud('booking-1');

    expect(result).toBe(false);
  });

  it('returns false when the booking is missing', async () => {
    mockPrisma.db.orm.public.Booking.where.mockReturnValue(mockFirst(null));

    const result = await service.checkFraud('missing-booking');

    expect(result).toBe(false);
    expect(
      mockPrisma.db.orm.public.FraudBlacklist.where,
    ).not.toHaveBeenCalled();
  });
});
