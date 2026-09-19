import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import { COMPLETION_ROUTING_KEYS } from '@/messaging/messaging.constants';
import { BookingStepCompletionMessage } from '@/messaging/messaging.types';
import { StepCompletionService } from '@/orchestrator/step-completion.service';
import { StageAdvancementService } from '@/orchestrator/stage-advancement.service';

@Controller()
export class StepCompletionController {
  private readonly logger = new Logger(StepCompletionController.name);

  constructor(
    private readonly completionService: StepCompletionService,
    private readonly stageAdvancementService: StageAdvancementService,
  ) {}

  @EventPattern(Object.values(COMPLETION_ROUTING_KEYS))
  async handle(
    @Payload() data: BookingStepCompletionMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    try {
      const updated = await this.completionService.applyCompletion(data);
      if (updated) {
        await this.stageAdvancementService.maybeAdvance(updated);
      }
      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error(
        `Failed to apply completion for stepId=${data.stepId}`,
        err instanceof Error ? err.stack : String(err),
      );
      channel.nack(originalMsg, false, false);
    }
  }
}
