import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { BookingModule } from '@/booking/booking.module';
import { MessagingModule } from '@/messaging/messaging.module';
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
    MessagingModule,
    GraphModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
