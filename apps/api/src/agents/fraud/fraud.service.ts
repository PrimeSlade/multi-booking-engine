import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class FraudService {
  constructor(private readonly prisma: PrismaService) {}

  async checkFraud(bookingId: string): Promise<boolean> {
    const booking = await this.prisma.db.orm.public.Booking.where({
      id: bookingId,
    })
      .all()
      .first();
    if (!booking) return false;

    const blacklisted = await this.prisma.db.orm.public.FraudBlacklist.where({
      userId: booking.userId,
    })
      .all()
      .first();

    return blacklisted !== null;
  }
}
