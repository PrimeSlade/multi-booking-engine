import { Module } from '@nestjs/common';
import { HotelAllotmentController } from '@/agents/hotel-allotment/hotel-allotment.controller';
import { HotelAllotmentService } from '@/agents/hotel-allotment/hotel-allotment.service';

@Module({
  controllers: [HotelAllotmentController],
  providers: [HotelAllotmentService],
  // Exported so the orchestrator's simulated other customer can reserve
  // through the same allotment code as a real booking.
  exports: [HotelAllotmentService],
})
export class HotelAllotmentModule {}
