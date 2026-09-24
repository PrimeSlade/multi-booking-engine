import { Module } from '@nestjs/common';
import { DispatchModule } from '@/dispatch/dispatch.module';
import { GraphModule } from '@/graph/graph.module';
import { StepCompletionController } from '@/orchestrator/completion/step-completion.controller';
import { StepCompletionService } from '@/orchestrator/completion/step-completion.service';
import { StageAdvancementService } from '@/orchestrator/advancement/stage-advancement.service';
import { StepCompensationController } from '@/orchestrator/compensation/step-compensation.controller';
import { StepCompensationService } from '@/orchestrator/compensation/step-compensation.service';
import { SagaCompensationService } from '@/orchestrator/compensation/saga-compensation.service';
import { BookingDecisionController } from '@/orchestrator/decision/booking-decision.controller';
import { BookingDecisionService } from '@/orchestrator/decision/booking-decision.service';
import { DecisionTimeoutService } from '@/orchestrator/decision/decision-timeout.service';

@Module({
  imports: [DispatchModule, GraphModule],
  controllers: [
    StepCompletionController,
    StepCompensationController,
    BookingDecisionController,
  ],
  providers: [
    StepCompletionService,
    StageAdvancementService,
    StepCompensationService,
    SagaCompensationService,
    BookingDecisionService,
    DecisionTimeoutService,
  ],
})
export class OrchestratorModule {}
