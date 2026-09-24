import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export type HotelAvailabilityOutcome =
  { available: true; roomId: string; roomType: string } | { available: false };

@Injectable()
export class HotelAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async checkAvailability(
    hotelBookingId: string | null,
  ): Promise<HotelAvailabilityOutcome> {
    if (!hotelBookingId) {
      return { available: false };
    }

    const hotelBooking = await this.prisma.db.orm.public.HotelBooking.where({
      id: hotelBookingId,
    })
      .all()
      .first();
    if (!hotelBooking?.roomId) {
      return { available: false };
    }

    const room = await this.prisma.db.orm.public.Room.where({
      id: hotelBooking.roomId,
    })
      .all()
      .first();
    if (!room || room.hotelId !== hotelBooking.hotelId || !room.available) {
      return { available: false };
    }

    return {
      available: true,
      roomId: room.id,
      roomType: room.roomType,
    };
  }
}
