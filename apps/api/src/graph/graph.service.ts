import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingGraph, ProductDefinition, StepConfig } from './graph.schema';
import {
  GeneratedGraphDto,
  GeneratedStageDto,
  GeneratedStepDto,
  GenerateGraphDto,
  ProductItemInput,
} from './dto';

@Injectable()
export class GraphService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Generates a staged booking execution graph based on the booking graph config template.
   */
  generate(dto: GenerateGraphDto): GeneratedGraphDto {
    const graph = this.configService.get<BookingGraph>('bookingGraph');
    if (!graph)
      throw new BadRequestException('Booking graph configuration not loaded');

    const requestedProducts = this.extractProductTypes(dto.products);
    this.validateProducts(requestedProducts, graph.products);

    const generatedSteps: GeneratedStepDto[] = [];
    const generatedStages: GeneratedStageDto[] = [];
    let stepIndex = 0;

    const stages = [...graph.itinerary.stages].sort(
      (a, b) => a.stage - b.stage,
    );

    for (const stageDef of stages) {
      const stageSteps: GeneratedStepDto[] = [];

      for (const stepRef of stageDef.steps) {
        if (this.shouldSkipStep(stepRef, requestedProducts, graph)) {
          continue;
        }

        const step = this.buildStep(
          stepRef,
          stageDef.stage,
          stepIndex++,
          graph,
        );
        stageSteps.push(step);
        generatedSteps.push(step);
      }

      if (stageSteps.length > 0) {
        generatedStages.push({
          stage: stageDef.stage,
          policy: stageDef.policy,
          ...(stageDef.join ? { join: stageDef.join } : {}),
          steps: stageSteps,
        });
      }
    }

    return {
      version: graph.version,
      stages: generatedStages,
      steps: generatedSteps,
      onPartialFailure: graph.itinerary.onPartialFailure,
      decisionTtlMs: graph.itinerary.decisionTtlMs,
      onDecisionTimeout: graph.itinerary.onDecisionTimeout,
    };
  }

  private extractProductTypes(items: ProductItemInput[]): string[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException(
        'At least one product is required to generate a booking graph',
      );
    }

    const types = items
      .map((item) => (typeof item === 'string' ? item : item?.type))
      .filter((type) => Boolean(type?.trim()))
      .map((type) => type.trim().toLowerCase());

    if (types.length === 0) {
      throw new BadRequestException(
        'At least one product is required to generate a booking graph',
      );
    }

    // Deduplicate so multiple items of the same product type (e.g. 2 hotels + 1 flight)
    // resolve cleanly without duplicate step conflicts
    return Array.from(new Set(types));
  }

  private validateProducts(
    requested: string[],
    available: Record<string, ProductDefinition>,
  ): void {
    const availableKeys = Object.keys(available);
    for (const prod of requested) {
      if (!available[prod]) {
        throw new BadRequestException(
          `Unsupported product type: "${prod}". Supported products: ${availableKeys.join(', ')}`,
        );
      }
    }
  }

  private shouldSkipStep(
    stepRef: string,
    requestedProducts: string[],
    graph: BookingGraph,
  ): boolean {
    // Shared itinerary steps (fraud, payment, notify) are never skipped
    if (graph.itinerary.sharedSteps[stepRef]) {
      return false;
    }

    const [product] = stepRef.split('.');
    // Product steps are skipped if that product is not part of this booking
    return !requestedProducts.includes(product);
  }

  private buildStep(
    stepRef: string,
    stage: number,
    stepIndex: number,
    graph: BookingGraph,
  ): GeneratedStepDto {
    const sharedConfig: StepConfig | undefined =
      graph.itinerary.sharedSteps[stepRef];

    if (sharedConfig) {
      return {
        stepIndex,
        stage,
        stepName: stepRef,
        scope: 'itinerary',
        product: null,
        agent: sharedConfig.agent,
        routingKey: sharedConfig.routingKey,
        timeoutMs: sharedConfig.timeoutMs,
        retry: {
          max: sharedConfig.retry.max,
          backoffMs: sharedConfig.retry.backoffMs,
        },
        ...(sharedConfig.compensate
          ? { compensate: sharedConfig.compensate }
          : {}),
      };
    }

    const [product, action] = stepRef.split('.');
    const productDef = graph.products[product];
    const productConfig = productDef?.steps.find((s) => s.stepName === action);

    if (!productConfig) {
      throw new BadRequestException(
        `Step configuration not found for "${stepRef}"`,
      );
    }

    return {
      stepIndex,
      stage,
      stepName: stepRef,
      scope: 'product',
      product,
      agent: productConfig.agent,
      routingKey: productConfig.routingKey,
      timeoutMs: productConfig.timeoutMs,
      retry: {
        max: productConfig.retry.max,
        backoffMs: productConfig.retry.backoffMs,
      },
      ...(productConfig.compensate
        ? { compensate: productConfig.compensate }
        : {}),
    };
  }
}
