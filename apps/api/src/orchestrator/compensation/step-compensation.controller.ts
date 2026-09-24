import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import { COMPENSATED_ROUTING_KEYS } from '@/messaging/messaging.constants';
import { BookingStepCompensatedMessage } from '@/messaging/messaging.types';
import { StepCompensationService } from '@/orchestrator/compensation/step-compensation.service';

@Controller()
export class StepCompensationController {
  private readonly logger = new Logger(StepCompensationController.name);

  constructor(private readonly compensationService: StepCompensationService) {}

  @EventPattern(Object.values(COMPENSATED_ROUTING_KEYS))
  async handle(
    @Payload() data: BookingStepCompensatedMessage,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef() as Channel;
    const originalMsg = context.getMessage() as Message;

    try {
      await this.compensationService.applyCompensated(data);
      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error(
        `Failed to apply compensated event for stepId=${data.stepId}`,
        err instanceof Error ? err.stack : String(err),
      );
      channel.nack(originalMsg, false, false);
    }
  }
}
