import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, RmqContext } from '@nestjs/microservices';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { QUEUES } from '@/messaging/messaging.constants';
import { RetryRouterService } from '@/messaging/retry-router.service';

@Controller()
export class RetryRouterController {
  constructor(private readonly retryRouter: RetryRouterService) {}

  @EventPattern(QUEUES.RETRY_INBOX)
  async handle(@Ctx() context: RmqContext): Promise<void> {
    await this.retryRouter.handle(
      context.getMessage() as ConsumeMessage,
      context.getChannelRef() as ConfirmChannel,
    );
  }
}
