import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class RetryPolicyDto {
  @IsInt()
  @Min(0)
  max: number;

  @IsInt()
  @Min(0)
  backoffMs: number;
}

export const STEP_SCOPES = ['product', 'itinerary'] as const;
export type StepScopeType = (typeof STEP_SCOPES)[number];

export const STAGE_POLICIES = ['parallel', 'sequential'] as const;
export type StagePolicyType = (typeof STAGE_POLICIES)[number];

export const STAGE_JOINS = ['all_or_ask'] as const;
export type StageJoinType = (typeof STAGE_JOINS)[number];

export class GeneratedStepDto {
  @IsInt()
  @Min(0)
  stepIndex: number;

  @IsInt()
  @Min(0)
  stage: number;

  @IsString()
  @IsNotEmpty()
  stepName: string;

  @IsIn(STEP_SCOPES)
  scope: StepScopeType;

  @IsOptional()
  @IsString()
  product: string | null;

  @IsString()
  @IsNotEmpty()
  agent: string;

  @IsString()
  @IsNotEmpty()
  routingKey: string;

  @IsInt()
  @Min(0)
  timeoutMs: number;

  @ValidateNested()
  @Type(() => RetryPolicyDto)
  retry: RetryPolicyDto;

  @IsOptional()
  @IsString()
  compensate?: string;
}

export class GeneratedStageDto {
  @IsInt()
  @Min(0)
  stage: number;

  @IsIn(STAGE_POLICIES)
  policy: StagePolicyType;

  @IsOptional()
  @IsIn(STAGE_JOINS)
  join?: StageJoinType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeneratedStepDto)
  steps: GeneratedStepDto[];
}

export class GeneratedGraphDto {
  @IsInt()
  @Min(1)
  version: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeneratedStageDto)
  stages: GeneratedStageDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeneratedStepDto)
  steps: GeneratedStepDto[];

  @IsString()
  @IsNotEmpty()
  onPartialFailure: string;

  @IsInt()
  @Min(0)
  decisionTtlMs: number;

  @IsString()
  @IsNotEmpty()
  onDecisionTimeout: string;
}

export type ProductItemInput = string | { type: string };

export class GenerateGraphDto {
  @IsArray()
  @ArrayMinSize(1)
  products: ProductItemInput[];
}
