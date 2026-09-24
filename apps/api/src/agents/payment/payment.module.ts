import { Module } from '@nestjs/common';
import { PaymentController } from '@/agents/payment/payment.controller';
import { PaymentService } from '@/agents/payment/payment.service';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
