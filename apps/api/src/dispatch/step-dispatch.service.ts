import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { BOOKING_RMQ_CLIENT } from '@/messaging/messaging.constants';
import { GeneratedStep } from '@/graph';
import { BookingStepDispatchMessage } from '@/dispatch/dispatch.types';

export type BookingStepRow = {
  id: string;
  bookingId: string;
  stepName: string;
  scope: 'product' | 'itinerary';
  agent: string;
  flightBookingId: string | null;
  hotelBookingId: string | null;
  attempt: number;
};

export type StepPair = { step: BookingStepRow; generated: GeneratedStep };

@Injectable()
export class StepDispatchService {
  private readonly logger = new Logger(StepDispatchService.name);

  constructor(
    @Inject(BOOKING_RMQ_CLIENT) private readonly client: ClientProxy,
  ) {}

  async dispatchSteps(pairs: StepPair[]): Promise<void> {
    const results = await Promise.allSettled(
      pairs.map((pair) => this.publishStep(pair)),
    );

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const { step, generated } = pairs[i];
        this.logger.error(
          `Failed to dispatch step "${step.stepName}" (stepId=${step.id}, bookingId=${step.bookingId}, routingKey=${generated.routingKey})`,
          result.reason instanceof Error
            ? result.reason.stack
            : String(result.reason),
        );
      }
    });
  }

  private async publishStep({ step, generated }: StepPair): Promise<void> {
    const message: BookingStepDispatchMessage = {
      stepId: step.id,
      bookingId: step.bookingId,
      stepName: step.stepName,
      scope: step.scope,
      agent: step.agent,
      flightBookingId: step.flightBookingId,
      hotelBookingId: step.hotelBookingId,
      attempt: step.attempt,
      timeoutMs: generated.timeoutMs,
      retry: generated.retry,
    };

    await firstValueFrom(this.client.emit(generated.routingKey, message));
  }
}
