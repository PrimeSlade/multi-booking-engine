import { Module } from '@nestjs/common';
import { StepDispatchService } from '@/dispatch/step-dispatch.service';

@Module({
  providers: [StepDispatchService],
  exports: [StepDispatchService],
})
export class DispatchModule {}
