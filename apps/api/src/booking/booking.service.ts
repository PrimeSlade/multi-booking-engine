import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  FlightProductDto,
  HotelProductDto,
  PublishBookingDto,
} from '@/booking/dto/publish-booking.dto';
import { GraphService } from '@/graph/graph.service';

type PlainProduct = { [key: string]: string | number };
@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graphService: GraphService,
  ) {}

  async publish(dto: PublishBookingDto) {
    const graph = this.graphService.generate({ products: dto.products });

    console.log(graph);

    // DTOs are class instances (may carry `undefined` optionals); project to
    // plain JSON-compatible data so the payload satisfies the Json column.
    const products = {
      graphVersion: graph.version,
      items: dto.products.map((product) => this.toPlainProduct(product)),
    };

    const booking = await this.prisma.db.orm.public.Booking.create({
      userId: dto.userId,
      status: 'in_progress',
      products,
    });

    const steps = [];
    for (const step of graph.steps) {
      const createdStep = await this.prisma.db.orm.public.BookingStep.create({
        bookingId: booking.id,
        stepIndex: step.stepIndex,
        stage: step.stage,
        stepName: step.stepName,
        scope: step.scope,
        product: step.product,
        agent: step.agent,
        status: 'pending',
        attempt: 0,
      });
      steps.push(createdStep);
    }

    return {
      ...booking,
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

    const stepRows = await this.prisma.db.orm.public.BookingStep.where({
      bookingId: id,
    })
      .all()
      .toArray();

    const steps = [...stepRows].sort((a, b) => a.stepIndex - b.stepIndex);

    return {
      ...booking,
      steps,
    };
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
