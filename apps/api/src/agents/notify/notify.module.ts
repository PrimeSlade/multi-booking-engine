import { Module } from '@nestjs/common';
import { NotifyController } from '@/agents/notify/notify.controller';
import { NotifyService } from '@/agents/notify/notify.service';

@Module({
  controllers: [NotifyController],
  providers: [NotifyService],
})
export class NotifyModule {}
