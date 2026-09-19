import { Module } from '@nestjs/common';
import { DispatchModule } from '@/dispatch/dispatch.module';
import { GraphModule } from '@/graph/graph.module';
import { StepCompletionController } from '@/orchestrator/step-completion.controller';
import { StepCompletionService } from '@/orchestrator/step-completion.service';
import { StageAdvancementService } from '@/orchestrator/stage-advancement.service';

@Module({
  imports: [DispatchModule, GraphModule],
  controllers: [StepCompletionController],
  providers: [StepCompletionService, StageAdvancementService],
})
export class OrchestratorModule {}
