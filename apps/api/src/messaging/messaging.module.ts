import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BOOKING_RMQ_CLIENT, EXCHANGES } from './messaging.constants';
import { RetryRouterService } from './retry-router.service';
import { RetryRouterController } from './retry-router.controller';

/**
 * RabbitMQ messaging module (booking.topic topology).
 *
 * Configures the official NestJS ClientProxy under BOOKING_RMQ_CLIENT for
 * topic exchange publishing with wildcards enabled.
 */
@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: BOOKING_RMQ_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>(
                'RABBITMQ_URL',
                'amqp://guest:guest@localhost:5672',
              ),
            ],
            exchange: configService.get<string>(
              'RABBITMQ_EXCHANGE',
              EXCHANGES.BOOKING_TOPIC,
            ),
            exchangeType: 'topic',
            wildcards: true,
            persistent: true,
          },
        }),
      },
    ]),
  ],
  providers: [RetryRouterService],
  controllers: [RetryRouterController],
  exports: [ClientsModule, RetryRouterService],
})
export class MessagingModule {}
