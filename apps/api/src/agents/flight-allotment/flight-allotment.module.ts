import { Module } from '@nestjs/common';
import { FlightAllotmentController } from '@/agents/flight-allotment/flight-allotment.controller';
import { FlightAllotmentService } from '@/agents/flight-allotment/flight-allotment.service';

@Module({
  controllers: [FlightAllotmentController],
  providers: [FlightAllotmentService],
  // Exported so the orchestrator's simulated other customer can reserve
  // through the same allotment code as a real booking.
  exports: [FlightAllotmentService],
})
export class FlightAllotmentModule {}
