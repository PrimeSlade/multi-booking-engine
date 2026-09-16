import type { RetryPolicy } from '../graph.schema';

export const STEP_SCOPES = ['product', 'itinerary'] as const;
export type StepScopeType = (typeof STEP_SCOPES)[number];

export const STAGE_POLICIES = ['parallel', 'sequential'] as const;
export type StagePolicyType = (typeof STAGE_POLICIES)[number];

export const STAGE_JOINS = ['all_or_ask'] as const;
export type StageJoinType = (typeof STAGE_JOINS)[number];

export type GeneratedStep = {
  stage: number;
  stepName: string;
  scope: StepScopeType;
  product: string | null;
  agent: string;
  routingKey: string;
  timeoutMs: number;
  retry: RetryPolicy;
  compensate?: string;
};

export type GeneratedStage = {
  stage: number;
  policy: StagePolicyType;
  join?: StageJoinType;
  steps: GeneratedStep[];
};

export type GeneratedGraph = {
  version: number;
  stages: GeneratedStage[];
  steps: GeneratedStep[];
  onPartialFailure: string;
  decisionTtlMs: number;
  onDecisionTimeout: string;
};

export type ProductItemInput = string | { type: string };

export type GenerateGraphInput = {
  products: ProductItemInput[];
};
