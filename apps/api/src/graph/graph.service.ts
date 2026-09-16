import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingGraph, ProductDefinition, StepConfig } from './graph.schema';
import {
  GeneratedGraph,
  GeneratedStage,
  GeneratedStep,
  GenerateGraphInput,
  ProductItemInput,
} from './types';

@Injectable()
export class GraphService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Generates a staged booking execution graph based on the booking graph config template.
   */
  generate(input: GenerateGraphInput): GeneratedGraph {
    const graph = this.configService.get<BookingGraph>('bookingGraph');
    if (!graph)
      throw new BadRequestException('Booking graph configuration not loaded');

    const requestedProducts = this.extractProductTypes(input.products);
    this.validateProducts(requestedProducts, graph.products);

    const steps: GeneratedStep[] = [];
    const stages: GeneratedStage[] = [];

    const stageDefs = [...graph.itinerary.stages].sort(
      (a, b) => a.stage - b.stage,
    );

    for (const stageDef of stageDefs) {
      const stageSteps = stageDef.steps
        .filter((stepRef) =>
          this.isStepIncluded(stepRef, requestedProducts, graph),
        )
        .map((stepRef) => this.buildStep(stepRef, stageDef.stage, graph));

      if (stageSteps.length === 0) continue;

      steps.push(...stageSteps);
      stages.push({
        stage: stageDef.stage,
        policy: stageDef.policy,
        ...(stageDef.join ? { join: stageDef.join } : {}),
        steps: stageSteps,
      });
    }

    return {
      version: graph.version,
      stages,
      steps,
      onPartialFailure: graph.itinerary.onPartialFailure,
      decisionTtlMs: graph.itinerary.decisionTtlMs,
      onDecisionTimeout: graph.itinerary.onDecisionTimeout,
    };
  }

  private extractProductTypes(items: ProductItemInput[]): string[] {
    const types = (Array.isArray(items) ? items : [])
      .map((item) => (typeof item === 'string' ? item : item?.type))
      .filter((type): type is string => Boolean(type?.trim()))
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
    for (const product of requested) {
      if (!available[product]) {
        throw new BadRequestException(
          `Unsupported product type: "${product}". Supported products: ${Object.keys(available).join(', ')}`,
        );
      }
    }
  }

  private isStepIncluded(
    stepRef: string,
    requestedProducts: string[],
    graph: BookingGraph,
  ): boolean {
    // Shared itinerary steps (fraud, payment, notify) always run
    if (graph.itinerary.sharedSteps[stepRef]) {
      return true;
    }

    const [product] = stepRef.split('.');
    return requestedProducts.includes(product);
  }

  private buildStep(
    stepRef: string,
    stage: number,
    graph: BookingGraph,
  ): GeneratedStep {
    const sharedConfig = graph.itinerary.sharedSteps[stepRef];
    if (sharedConfig) {
      return this.toGeneratedStep(stepRef, stage, {
        scope: 'itinerary',
        product: null,
        config: sharedConfig,
      });
    }

    const [product, action] = stepRef.split('.');
    const config = graph.products[product]?.steps.find(
      (s) => s.stepName === action,
    );
    if (!config) {
      throw new BadRequestException(
        `Step configuration not found for "${stepRef}"`,
      );
    }

    return this.toGeneratedStep(stepRef, stage, {
      scope: 'product',
      product,
      config,
    });
  }

  private toGeneratedStep(
    stepRef: string,
    stage: number,
    options: {
      scope: 'product' | 'itinerary';
      product: string | null;
      config: StepConfig;
    },
  ): GeneratedStep {
    const { scope, product, config } = options;
    return {
      stage,
      stepName: stepRef,
      scope,
      product,
      agent: config.agent,
      routingKey: config.routingKey,
      timeoutMs: config.timeoutMs,
      retry: {
        max: config.retry.max,
        backoffMs: config.retry.backoffMs,
      },
      ...(config.compensate ? { compensate: config.compensate } : {}),
    };
  }
}
