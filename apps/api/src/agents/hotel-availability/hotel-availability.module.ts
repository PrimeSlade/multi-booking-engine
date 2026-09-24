import { Module } from '@nestjs/common';
import { HotelAvailabilityController } from '@/agents/hotel-availability/hotel-availability.controller';
import { HotelAvailabilityService } from '@/agents/hotel-availability/hotel-availability.service';

@Module({
  controllers: [HotelAvailabilityController],
  providers: [HotelAvailabilityService],
})
export class HotelAvailabilityModule {}
