import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class FlightAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async checkAvailability(
    flightBookingId: string | null,
  ): Promise<{ available: boolean; seatsLeft?: number }> {
    if (!flightBookingId) {
      return { available: false };
    }

    const flightBooking = await this.prisma.db.orm.public.FlightBooking.where({
      id: flightBookingId,
    })
      .all()
      .first();
    if (!flightBooking) {
      return { available: false };
    }

    const flight = await this.prisma.db.orm.public.Flight.where({
      id: flightBooking.flightId,
    })
      .all()
      .first();
    if (!flight || flight.seatsLeft <= 0) {
      return { available: false };
    }

    return { available: true, seatsLeft: flight.seatsLeft };
  }
}
