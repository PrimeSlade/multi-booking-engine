import { z } from 'zod';

export const dispatchEnvelopeSchema = z.object({
  pattern: z.string(),
  data: z.object({
    stepId: z.string(),
    bookingId: z.string(),
    stepName: z.string(),
    scope: z.enum(['product', 'itinerary']),
    agent: z.string(),
    flightBookingId: z.string().nullable(),
    hotelBookingId: z.string().nullable(),
    attempt: z.number().int().nonnegative(),
    timeoutMs: z.number().int().positive(),
    retry: z.object({
      max: z.number().int().nonnegative(),
      backoffMs: z.number().int().nonnegative(),
    }),
  }),
});
