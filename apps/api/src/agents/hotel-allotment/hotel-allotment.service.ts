import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export type HotelAllotmentOutcome =
  { reserved: true; roomsLeft: number } | { reserved: false };

@Injectable()
export class HotelAllotmentService {
  constructor(private readonly prisma: PrismaService) {}

  async reserveRoom(
    hotelBookingId: string | null,
  ): Promise<HotelAllotmentOutcome> {
    if (!hotelBookingId) return { reserved: false };

    const hotelBooking = await this.prisma.db.orm.public.HotelBooking.where({
      id: hotelBookingId,
    })
      .all()
      .first();
    if (!hotelBooking?.roomId) return { reserved: false };

    const roomTable = this.prisma.db.sql.public.room;
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- same ts-jest-vs-tsc generic inference quirk as flight allotment. */
    const plan = roomTable
      .update((r: any, fns: any) => ({
        rooms_left: fns.raw`${r.rooms_left} - ${hotelBooking.rooms}`.returns(
          roomTable.columns.rooms_left,
        ),
      }))
      .where((r: any, fns: any) =>
        fns.and(
          fns.eq(r.id, hotelBooking.roomId),
          fns.eq(r.hotel_id, hotelBooking.hotelId),
          fns.gte(r.rooms_left, hotelBooking.rooms),
        ),
      )
      .returning('id', 'rooms_left')
      .build();
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

    const rows = await this.prisma.db.runtime().query(plan);
    return rows.length > 0
      ? { reserved: true, roomsLeft: rows[0].rooms_left }
      : { reserved: false };
  }

  async releaseRoom(
    hotelBookingId: string | null,
  ): Promise<{ released: boolean }> {
    if (!hotelBookingId) return { released: false };

    const hotelBooking = await this.prisma.db.orm.public.HotelBooking.where({
      id: hotelBookingId,
    })
      .all()
      .first();
    if (!hotelBooking?.roomId) return { released: false };

    const roomTable = this.prisma.db.sql.public.room;
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- same ts-jest-vs-tsc generic inference quirk as flight allotment. */
    const plan = roomTable
      .update((r: any, fns: any) => ({
        rooms_left: fns.raw`${r.rooms_left} + ${hotelBooking.rooms}`.returns(
          roomTable.columns.rooms_left,
        ),
      }))
      .where((r: any, fns: any) =>
        fns.and(
          fns.eq(r.id, hotelBooking.roomId),
          fns.eq(r.hotel_id, hotelBooking.hotelId),
        ),
      )
      .returning('id', 'rooms_left')
      .build();
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

    const rows = await this.prisma.db.runtime().query(plan);
    return { released: rows.length > 0 };
  }
}
