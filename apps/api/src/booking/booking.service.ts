import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  FlightProductDto,
  HotelProductDto,
  PublishBookingDto,
} from '@/booking/dto/publish-booking.dto';

// TODO: source from GraphConfigService (booking-graph.yml `version`) once it
// lands. Kept as a const so publish-time snapshots stay explicit and the
// RabbitMQ/orchestration work can wire it up without touching this service.
export const BOOKING_GRAPH_VERSION = 1;

type PlainProduct = { [key: string]: string | number };

@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}

  publish(dto: PublishBookingDto) {
    // DTOs are class instances (may carry `undefined` optionals); project to
    // plain JSON-compatible data so the payload satisfies the Json column.
    const products = {
      graphVersion: BOOKING_GRAPH_VERSION,
      items: dto.products.map((product) => this.toPlainProduct(product)),
    };
    return this.prisma.db.orm.public.Booking.create({
      userId: dto.userId,
      status: 'in_progress',
      products,
    });
  }

  findById(id: string) {
    return this.prisma.db.orm.public.Booking.where({ id }).all().first();
  }

  private toPlainProduct(
    product: FlightProductDto | HotelProductDto,
  ): PlainProduct {
    const plain: PlainProduct = { type: product.type };
    // All DTO fields are validated strings/numbers; drop `undefined` optionals.
    for (const [key, value] of Object.entries(product)) {
      if (value !== undefined) {
        plain[key] = value as string | number;
      }
    }
    return plain;
  }
}
