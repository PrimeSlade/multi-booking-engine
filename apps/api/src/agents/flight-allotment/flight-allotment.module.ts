import { Module } from '@nestjs/common';
import { FlightAllotmentController } from '@/agents/flight-allotment/flight-allotment.controller';
import { FlightAllotmentService } from '@/agents/flight-allotment/flight-allotment.service';

@Module({
  controllers: [FlightAllotmentController],
  providers: [FlightAllotmentService],
})
export class FlightAllotmentModule {}
