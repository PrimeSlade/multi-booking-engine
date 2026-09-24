import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { BookingDecisionService } from '@/orchestrator/decision/booking-decision.service';

const DECISION_SWEEP_INTERVAL_MS = 5000;

@Injectable()
export class DecisionTimeoutService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DecisionTimeoutService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly decisionService: BookingDecisionService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.sweep();
    }, DECISION_SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    try {
      const count = await this.decisionService.expireDueDecisions();
      if (count > 0) {
        this.logger.warn(`Expired ${count} partial-booking decision(s)`);
      }
    } catch (err) {
      this.logger.error(
        'Partial-booking decision sweep failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
