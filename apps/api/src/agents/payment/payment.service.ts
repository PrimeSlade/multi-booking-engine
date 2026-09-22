import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const DECLINED_USER_ID = 'declined@email.com';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async processPayment(bookingId: string): Promise<boolean> {
    const booking = await this.prisma.db.orm.public.Booking.where({
      id: bookingId,
    })
      .all()
      .first();
    if (!booking) return true; // can't find the booking to charge - fail closed

    return booking.userId === DECLINED_USER_ID;
  }
}
