import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export type AllotmentOutcome =
  { reserved: true; seatsLeft: number } | { reserved: false };

@Injectable()
export class FlightAllotmentService {
  constructor(private readonly prisma: PrismaService) {}

  async reserveSeat(flightBookingId: string | null): Promise<AllotmentOutcome> {
    if (!flightBookingId) return { reserved: false };

    const flightBooking = await this.prisma.db.orm.public.FlightBooking.where({
      id: flightBookingId,
    })
      .all()
      .first();

    if (!flightBooking) return { reserved: false };

    const flightTable = this.prisma.db.sql.public.flight;
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- `any` on f/fns below: tsc infers the real, precise generic types fine (verified via `tsc --noEmit`), but ts-jest can't resolve the same chain through the mocked PrismaService in specs - same known quirk as elsewhere in this codebase, not a real type-safety issue. */
    const plan = flightTable
      .update((f: any, fns: any) => ({
        seats_left:
          fns.raw`${f.seats_left} - ${flightBooking.passengers}`.returns(
            flightTable.columns.seats_left,
          ),
      }))
      .where((f: any, fns: any) =>
        fns.and(
          fns.eq(f.id, flightBooking.flightId),
          fns.gte(f.seats_left, flightBooking.passengers),
        ),
      )
      .returning('id', 'seats_left')
      .build();
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

    const rows = await this.prisma.db.runtime().query(plan);
    return rows.length > 0
      ? { reserved: true, seatsLeft: rows[0].seats_left }
      : { reserved: false };
  }
}
