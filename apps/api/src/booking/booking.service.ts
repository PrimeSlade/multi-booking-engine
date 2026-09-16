import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  FlightProductDto,
  HotelProductDto,
  PublishBookingDto,
} from '@/booking/dto/publish-booking.dto';
import { GeneratedStep } from '@/graph';
import { GraphService } from '@/graph/graph.service';

type StepPlacement = {
  step: GeneratedStep;
  flightBookingId: string | null;
  hotelBookingId: string | null;
};

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graphService: GraphService,
  ) {}

  async publish(dto: PublishBookingDto) {
    const graph = this.graphService.generate({ products: dto.products });

    const booking = await this.prisma.db.orm.public.Booking.create({
      userId: dto.userId,
      status: 'in_progress',
    });

    const flightProducts = dto.products.filter(
      (p): p is FlightProductDto => p.type === 'flight',
    );
    const hotelProducts = dto.products.filter(
      (p): p is HotelProductDto => p.type === 'hotel',
    );

    // Each submitted flight leg / hotel stay becomes its own row, so
    // product-scope steps below can be fanned out per item rather than per type.
    const [flightBookings, hotelBookings] = await Promise.all([
      Promise.all(
        flightProducts.map((product) =>
          this.prisma.db.orm.public.FlightBooking.create({
            bookingId: booking.id,
            flightId: product.flightId,
            flightNumber: product.flightNumber,
            origin: product.origin,
            destination: product.destination,
            departureDate: product.departureDate,
            passengers: product.passengers ?? 1,
          }),
        ),
      ),
      Promise.all(
        hotelProducts.map((product) =>
          this.prisma.db.orm.public.HotelBooking.create({
            bookingId: booking.id,
            hotelId: product.hotelId,
            hotelName: product.hotelName,
            roomId: product.roomId,
            roomType: product.roomType,
            city: product.city,
            checkIn: product.checkIn,
            checkOut: product.checkOut,
            rooms: product.rooms ?? 1,
          }),
        ),
      ),
    ]);

    // A product-scope step in the graph (e.g. "hotel.availability") represents
    // one step per product *type*; expand it into one BookingStep per matching
    // item. Itinerary-scope steps stay shared (both FK columns null).
    const stepPlacements = graph.steps.flatMap((step) =>
      this.expandStep(step, flightBookings, hotelBookings),
    );

    const steps = await Promise.all(
      stepPlacements.map((placement, index) =>
        this.prisma.db.orm.public.BookingStep.create({
          bookingId: booking.id,
          flightBookingId: placement.flightBookingId,
          hotelBookingId: placement.hotelBookingId,
          stepIndex: index,
          stage: placement.step.stage,
          stepName: placement.step.stepName,
          scope: placement.step.scope,
          agent: placement.step.agent,
          status: 'pending',
          attempt: 0,
        }),
      ),
    );

    return {
      ...booking,
      flightBookings,
      hotelBookings,
      steps,
    };
  }

  async findById(id: string) {
    const booking = await this.prisma.db.orm.public.Booking.where({ id })
      .all()
      .first();
    if (!booking) {
      return null;
    }

    const [flightBookings, hotelBookings, stepRows] = await Promise.all([
      this.prisma.db.orm.public.FlightBooking.where({ bookingId: id })
        .all()
        .toArray(),
      this.prisma.db.orm.public.HotelBooking.where({ bookingId: id })
        .all()
        .toArray(),
      this.prisma.db.orm.public.BookingStep.where({ bookingId: id })
        .all()
        .toArray(),
    ]);

    const steps = [...stepRows].sort((a, b) => a.stepIndex - b.stepIndex);

    return {
      ...booking,
      flightBookings,
      hotelBookings,
      steps,
    };
  }

  private expandStep(
    step: GeneratedStep,
    flightBookings: Array<{ id: string }>,
    hotelBookings: Array<{ id: string }>,
  ): StepPlacement[] {
    if (step.scope === 'itinerary') {
      return [{ step, flightBookingId: null, hotelBookingId: null }];
    }
    if (step.product === 'flight') {
      return flightBookings.map((item) => ({
        step,
        flightBookingId: item.id,
        hotelBookingId: null,
      }));
    }
    if (step.product === 'hotel') {
      return hotelBookings.map((item) => ({
        step,
        flightBookingId: null,
        hotelBookingId: item.id,
      }));
    }
    return [];
  }
}
