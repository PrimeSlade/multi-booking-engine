import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAvailableFlights() {
    // Sold-out flights (seatsLeft 0) are included so the frontend can show
    // them as unavailable instead of hiding them.
    // Explicit ordering keeps the list stable. Without it, Postgres returns
    // rows in storage order, which changes when a booking updates seatsLeft.
    return this.prisma.db.orm.public.Flight.orderBy([
      (f) => f.departureTime.asc(),
      (f) => f.id.asc(),
    ]).all();
  }

  async findAvailableHotels() {
    // Sold-out rooms (roomsLeft 0) are included, same as flights above.
    return this.prisma.db.orm.public.Hotel.include('rooms', (rooms) =>
      rooms.orderBy((r) => r.id.asc()),
    )
      .orderBy([(h) => h.name.asc(), (h) => h.id.asc()])
      .all();
  }
}
