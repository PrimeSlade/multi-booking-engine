jest.mock('@/prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let mockPrisma: {
    db: { orm: { public: { Booking: { where: jest.Mock } } } };
  };
  let service: PaymentService;

  const mockFirst = (value: unknown) => ({
    all: jest.fn().mockReturnValue({
      first: jest.fn().mockResolvedValue(value),
    }),
  });

  beforeEach(() => {
    mockPrisma = {
      db: { orm: { public: { Booking: { where: jest.fn() } } } },
    };
    service = new PaymentService(mockPrisma as never);
  });

  it('declines payment for the sentinel userId', async () => {
    mockPrisma.db.orm.public.Booking.where.mockReturnValue(
      mockFirst({ id: 'booking-1', userId: 'declined@email.com' }),
    );

    const result = await service.processPayment('booking-1');

    expect(result).toBe(true);
  });

  it('does not decline payment for any other userId', async () => {
    mockPrisma.db.orm.public.Booking.where.mockReturnValue(
      mockFirst({ id: 'booking-1', userId: 'clean-user' }),
    );

    const result = await service.processPayment('booking-1');

    expect(result).toBe(false);
  });

  it('declines payment when the booking is missing (fails closed)', async () => {
    mockPrisma.db.orm.public.Booking.where.mockReturnValue(mockFirst(null));

    const result = await service.processPayment('missing-booking');

    expect(result).toBe(true);
  });
});
