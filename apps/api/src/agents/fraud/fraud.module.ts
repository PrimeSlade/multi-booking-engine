import { Module } from '@nestjs/common';
import { FraudController } from '@/agents/fraud/fraud.controller';
import { FraudService } from '@/agents/fraud/fraud.service';

@Module({
  controllers: [FraudController],
  providers: [FraudService],
})
export class FraudModule {}
