import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import {
  EXCHANGES,
  QUEUES,
  ROUTING_PATTERNS,
} from '@/messaging/messaging.constants';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableCors();

  const configService = app.get(ConfigService);
  const rmqUrl = configService.get<string>(
    'RABBITMQ_URL',
    'amqp://localhost:5672',
  );

  const rmqExchange = configService.get<string>(
    'RABBITMQ_EXCHANGE',
    EXCHANGES.BOOKING_TOPIC,
  );

  // One RMQ listener per queue: the shared "step completed" queue, plus one
  // per agent's own step queue (currently flight-agent's availability check
  // and fraud-agent's fraud check; more get appended here as agents are
  // added).
  //
  // wildcards is off and routingKey is explicit on all of them: with
  // wildcards on, a queue auto-binds to every @EventPattern registered
  // anywhere in the app (registration is global, not scoped per
  // connectMicroservice call), so every queue would end up receiving - and
  // processing a duplicate copy of - every other queue's messages too. An
  // explicit routingKey binds only what each queue is actually meant to
  // receive.
  const rmqListeners: Array<{ queue: string; routingKey: string }> = [
    { queue: QUEUES.COMPLETED, routingKey: ROUTING_PATTERNS.ALL_COMPLETED },
    {
      queue: QUEUES.FLIGHT_AVAILABILITY,
      routingKey: QUEUES.FLIGHT_AVAILABILITY,
    },
    { queue: QUEUES.FRAUD, routingKey: QUEUES.FRAUD },
    { queue: QUEUES.FLIGHT_ALLOTMENT, routingKey: QUEUES.FLIGHT_ALLOTMENT },
    { queue: QUEUES.PAYMENT, routingKey: QUEUES.PAYMENT },
    {
      queue: QUEUES.FLIGHT_ALLOTMENT_COMPENSATE,
      routingKey: QUEUES.FLIGHT_ALLOTMENT_COMPENSATE,
    },
    { queue: QUEUES.COMPENSATED, routingKey: ROUTING_PATTERNS.ALL_COMPENSATED },
  ];

  for (const { queue, routingKey } of rmqListeners) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rmqUrl],
        queue,
        exchange: rmqExchange,
        exchangeType: 'topic',
        wildcards: false,
        routingKey,
        noAck: false, // enables manual acknowledgment
        queueOptions: {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': EXCHANGES.BOOKING_DLX,
          },
        },
      },
    });
  }

  await app.startAllMicroservices();

  // Enable global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global cross-cutting concerns: structured errors + response envelope
  app.useGlobalFilters(new AllExceptionsFilter());
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));

  // Swagger API Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Multi-Booking Engine API')
    .setDescription(
      'Distributed multi-product booking orchestration engine. Coordinates staged execution graphs across flight and hotel providers with RabbitMQ messaging and compensation sagas.',
    )
    .setVersion('1.0.0')
    .addTag('Bookings', 'Booking lifecycle and staged step execution')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger API docs available at: http://localhost:${port}/api`);
}

void bootstrap();
