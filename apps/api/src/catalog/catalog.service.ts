import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAvailableFlights() {
    return this.prisma.db.orm.public.Flight.where((f) =>
      f.seatsLeft.gt(0),
    ).all();
  }

  async findAvailableHotels() {
    return this.prisma.db.orm.public.Hotel.include('rooms', (rooms) =>
      rooms.where((r) => r.roomsLeft.gt(0)),
    ).all();
  }
}
