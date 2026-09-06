import { Module } from '@nestjs/common';
import { BookingController } from '@/booking/booking.controller';
import { BookingService } from '@/booking/booking.service';

@Module({
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
