import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { FlightAllotmentService } from '@/agents/flight-allotment/flight-allotment.service';
import { HotelAllotmentService } from '@/agents/hotel-allotment/hotel-allotment.service';

// The made-up customer who books the item first. Their bookings are real
// Booking rows, so you can look them up like any other booking.
export const OTHER_CUSTOMER_ID = 'another-customer@demo.com';

type FlightItem = {
  id: string;
  flightId: string;
  flightNumber: string | null;
  origin: string;
  destination: string;
  departureDate: string;
  passengers: number;
};

type HotelItem = {
  id: string;
  hotelId: string;
  hotelName: string | null;
  roomId: string | null;
  roomType: string | null;
  city: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
};

// Demo only. For items the user ticked "Someone else takes this", the backend
// acts as another customer: right before this booking's reservation step, it
// creates a real booking for OTHER_CUSTOMER_ID and reserves the same flight or
// room through the normal allotment code. It books just enough that the
// user's request no longer fits, so the user's reservation fails for real.
// The other customer's booking is kept: re-seed to restore inventory.
@Injectable()
export class SimulatedCompetitorService {
  private readonly logger = new Logger(SimulatedCompetitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flightAllotment: FlightAllotmentService,
    private readonly hotelAllotment: HotelAllotmentService,
  ) {}

  // Called once, right before the reservation (allotment) stage is dispatched.
  async takeMarkedItems(bookingId: string): Promise<void> {
    const [flightItems, hotelItems] = await Promise.all([
      this.prisma.db.orm.public.FlightBooking.where({
        bookingId,
        simulateTakenByOther: true,
      })
        .all()
        .toArray(),
      this.prisma.db.orm.public.HotelBooking.where({
        bookingId,
        simulateTakenByOther: true,
      })
        .all()
        .toArray(),
    ]);

    for (const item of flightItems) {
      if (item.simulatedTakenCount > 0) continue; // already taken
      await this.bookFlightAsOtherCustomer(item);
    }
    for (const item of hotelItems) {
      if (item.simulatedTakenCount > 0) continue;
      await this.bookRoomAsOtherCustomer(item);
    }
  }

  // Books (seatsLeft - (requested - 1)) seats, leaving one fewer than the
  // user asked for.
  private async bookFlightAsOtherCustomer(item: FlightItem): Promise<void> {
    const flight = await this.prisma.db.orm.public.Flight.where({
      id: item.flightId,
    })
      .all()
      .first();
    if (!flight) return;

    const take = flight.seatsLeft - (item.passengers - 1);
    if (take <= 0) return; // already not enough seats, nothing to take

    const otherBooking = await this.prisma.db.orm.public.Booking.create({
      userId: OTHER_CUSTOMER_ID,
      status: 'in_progress',
    });
    const otherItem = await this.prisma.db.orm.public.FlightBooking.create({
      bookingId: otherBooking.id,
      flightId: item.flightId,
      flightNumber: item.flightNumber,
      origin: item.origin,
      destination: item.destination,
      departureDate: item.departureDate,
      passengers: take,
    });

    // Same guarded UPDATE a real booking's allotment step uses.
    const outcome = await this.flightAllotment.reserveSeat(otherItem.id);
    await this.prisma.db.orm.public.Booking.where({
      id: otherBooking.id,
    }).update({ status: outcome.reserved ? 'confirmed' : 'failed' });
    if (!outcome.reserved) {
      this.logger.warn(
        `Other customer could not book flight ${item.flightId} (booking ${otherBooking.id})`,
      );
      return;
    }

    await this.prisma.db.orm.public.FlightBooking.where({
      id: item.id,
    }).update({ simulatedTakenCount: take });
    this.logger.log(
      `Other customer booked ${take} seats on ${item.flightId} (booking ${otherBooking.id})`,
    );
  }

  // Books (roomsLeft - (requested - 1)) rooms, leaving one fewer than the
  // user asked for.
  private async bookRoomAsOtherCustomer(item: HotelItem): Promise<void> {
    if (!item.roomId) return;
    const room = await this.prisma.db.orm.public.Room.where({
      id: item.roomId,
    })
      .all()
      .first();
    if (!room) return;

    const take = room.roomsLeft - (item.rooms - 1);
    if (take <= 0) return;

    const otherBooking = await this.prisma.db.orm.public.Booking.create({
      userId: OTHER_CUSTOMER_ID,
      status: 'in_progress',
    });
    const otherItem = await this.prisma.db.orm.public.HotelBooking.create({
      bookingId: otherBooking.id,
      hotelId: item.hotelId,
      hotelName: item.hotelName,
      roomId: item.roomId,
      roomType: item.roomType,
      city: item.city,
      checkIn: item.checkIn,
      checkOut: item.checkOut,
      rooms: take,
    });

    const outcome = await this.hotelAllotment.reserveRoom(otherItem.id);
    await this.prisma.db.orm.public.Booking.where({
      id: otherBooking.id,
    }).update({ status: outcome.reserved ? 'confirmed' : 'failed' });
    if (!outcome.reserved) {
      this.logger.warn(
        `Other customer could not book room ${item.roomId} (booking ${otherBooking.id})`,
      );
      return;
    }

    await this.prisma.db.orm.public.HotelBooking.where({
      id: item.id,
    }).update({ simulatedTakenCount: take });
    this.logger.log(
      `Other customer booked ${take} rooms of ${item.roomId} (booking ${otherBooking.id})`,
    );
  }
}
