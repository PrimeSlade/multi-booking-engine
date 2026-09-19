import { Module } from '@nestjs/common';
import { StepCompletionController } from '@/orchestrator/step-completion.controller';
import { StepCompletionService } from '@/orchestrator/step-completion.service';

@Module({
  controllers: [StepCompletionController],
  providers: [StepCompletionService],
})
export class OrchestratorModule {}
