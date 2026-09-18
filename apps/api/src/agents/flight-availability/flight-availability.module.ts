import { Module } from '@nestjs/common';
import { FlightAvailabilityController } from '@/agents/flight-availability/flight-availability.controller';
import { FlightAvailabilityService } from '@/agents/flight-availability/flight-availability.service';

@Module({
  controllers: [FlightAvailabilityController],
  providers: [FlightAvailabilityService],
})
export class FlightAvailabilityModule {}
