import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { FlightAvailabilityModule } from '@/agents/flight-availability/flight-availability.module';
import { FraudModule } from '@/agents/fraud/fraud.module';
import { FlightAllotmentModule } from '@/agents/flight-allotment/flight-allotment.module';
import { PaymentModule } from '@/agents/payment/payment.module';
import { NotifyModule } from '@/agents/notify/notify.module';
import { HotelAvailabilityModule } from '@/agents/hotel-availability/hotel-availability.module';
import { HotelAllotmentModule } from '@/agents/hotel-allotment/hotel-allotment.module';
import { BookingModule } from '@/booking/booking.module';
import { CatalogModule } from '@/catalog/catalog.module';
import { MessagingModule } from '@/messaging/messaging.module';
import { OrchestratorModule } from '@/orchestrator/orchestrator.module';
import { PrismaModule } from '@/prisma/prisma.module';
import bookingGraphConfig from '@/graph/config/booking-graph.config';
import { GraphModule } from '@/graph/graph.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [bookingGraphConfig],
    }),
    PrismaModule,
    BookingModule,
    CatalogModule,
    MessagingModule,
    GraphModule,
    FlightAvailabilityModule,
    HotelAvailabilityModule,
    FraudModule,
    FlightAllotmentModule,
    HotelAllotmentModule,
    PaymentModule,
    NotifyModule,
    OrchestratorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
