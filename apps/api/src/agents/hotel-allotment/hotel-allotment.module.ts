import { Module } from '@nestjs/common';
import { HotelAllotmentController } from '@/agents/hotel-allotment/hotel-allotment.controller';
import { HotelAllotmentService } from '@/agents/hotel-allotment/hotel-allotment.service';

@Module({
  controllers: [HotelAllotmentController],
  providers: [HotelAllotmentService],
})
export class HotelAllotmentModule {}
