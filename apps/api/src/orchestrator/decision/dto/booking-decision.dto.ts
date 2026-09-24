import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const BOOKING_DECISIONS = ['accept_partial', 'reject_all'] as const;
export type BookingDecision = (typeof BOOKING_DECISIONS)[number];

export class BookingDecisionDto {
  @ApiProperty({ enum: BOOKING_DECISIONS, example: 'accept_partial' })
  @IsIn(BOOKING_DECISIONS)
  decision: BookingDecision;
}
