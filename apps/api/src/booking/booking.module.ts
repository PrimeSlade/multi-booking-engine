import { Module } from '@nestjs/common';
import { BookingController } from '@/booking/booking.controller';
import { BookingService } from '@/booking/booking.service';
import { DispatchModule } from '@/dispatch/dispatch.module';
import { GraphModule } from '@/graph/graph.module';

@Module({
  imports: [GraphModule, DispatchModule],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
