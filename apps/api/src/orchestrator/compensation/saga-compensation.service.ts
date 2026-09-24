import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { GraphService } from '@/graph/graph.service';
import {
  BookingStepRow,
  StepDispatchService,
} from '@/dispatch/step-dispatch.service';

@Injectable()
export class SagaCompensationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graphService: GraphService,
    private readonly dispatchService: StepDispatchService,
  ) {}

  async compensateSuccessfulSteps(bookingId: string): Promise<void> {
    const [flightBookings, hotelBookings] = await Promise.all([
      this.prisma.db.orm.public.FlightBooking.where({ bookingId })
        .all()
        .toArray(),
      this.prisma.db.orm.public.HotelBooking.where({ bookingId })
        .all()
        .toArray(),
    ]);
    const products = [
      ...(flightBookings.length ? ['flight'] : []),
      ...(hotelBookings.length ? ['hotel'] : []),
    ];
    const graph = this.graphService.generate({ products });
    const compensatable = new Set(
      graph.steps
        .filter((step) => step.compensate)
        .map((step) => step.stepName),
    );
    if (compensatable.size === 0) return;

    const successSteps = await this.prisma.db.orm.public.BookingStep.where({
      bookingId,
      status: 'success',
    })
      .all()
      .toArray();
    const eligible = successSteps.filter((step: BookingStepRow) =>
      compensatable.has(step.stepName),
    );
    if (eligible.length === 0) return;

    const claims = await Promise.all(
      eligible.map(async (row: BookingStepRow) => {
        const updated = await this.prisma.db.orm.public.BookingStep.where({
          id: row.id,
          status: 'success',
        }).update({ status: 'compensating' });
        return updated ? row : null;
      }),
    );
    const claimed = claims.filter(
      (row: BookingStepRow | null): row is BookingStepRow => row !== null,
    );
    if (claimed.length === 0) return;

    await this.dispatchService.dispatchCompensations(claimed);
  }
}
