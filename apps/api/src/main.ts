import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { EXCHANGES, QUEUES } from '@/messaging/messaging.constants';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableCors();

  const configService = app.get(ConfigService);
  const rmqUrl = configService.get<string>(
    'RABBITMQ_URL',
    'amqp://localhost:5672',
  );

  // Orchestrator Step Completed Queue (with DLQ configured)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rmqUrl],
      queue: QUEUES.COMPLETED,
      exchange: configService.get<string>(
        'RABBITMQ_EXCHANGE',
        EXCHANGES.BOOKING_TOPIC,
      ),
      exchangeType: 'topic',
      wildcards: true,
      noAck: false, // enables manual acknowledgment
      queueOptions: {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': EXCHANGES.BOOKING_DLX,
        },
      },
    },
  });

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
