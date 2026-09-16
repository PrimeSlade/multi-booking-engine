import { z } from 'zod';

export const RetryPolicySchema = z.object({
  max: z.number().int().nonnegative(),
  backoffMs: z.number().int().nonnegative(),
});

export const StepConfigSchema = z.object({
  stepName: z.string().optional(),
  agent: z.string(),
  scope: z.enum(['product', 'itinerary']),
  routingKey: z.string(),
  timeoutMs: z.number().int().positive(),
  retry: RetryPolicySchema,
  compensate: z.string().optional(),
});

export const ProductDefinitionSchema = z.object({
  steps: z.array(StepConfigSchema),
});

export const StageDefinitionSchema = z.object({
  stage: z.number().int().nonnegative(),
  policy: z.enum(['parallel', 'sequential']),
  join: z.enum(['all_or_ask']).optional(),
  steps: z.array(z.string()),
});

export const ItineraryDefinitionSchema = z.object({
  stages: z.array(StageDefinitionSchema),
  sharedSteps: z.record(z.string(), StepConfigSchema),
  onPartialFailure: z.string(),
  decisionTtlMs: z.number().int().positive(),
  onDecisionTimeout: z.string(),
});

export const BookingGraphSchema = z.object({
  version: z.number().int().positive(),
  products: z.record(z.string(), ProductDefinitionSchema),
  itinerary: ItineraryDefinitionSchema,
});

export type BookingGraph = z.infer<typeof BookingGraphSchema>;
export type StepConfig = z.infer<typeof StepConfigSchema>;
export type ProductDefinition = z.infer<typeof ProductDefinitionSchema>;
export type StageDefinition = z.infer<typeof StageDefinitionSchema>;
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;
