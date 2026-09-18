export type BookingStepCompletionMessage = {
  stepId: string;
  bookingId: string;
  stepName: string;
  scope: 'product' | 'itinerary';
  agent: string;
  flightBookingId: string | null;
  hotelBookingId: string | null;
  attempt: number;
  status: 'success' | 'failed';
  result?: Record<string, unknown> | null;
  error?: { code: string; message?: string; retryable: boolean } | null;
};
