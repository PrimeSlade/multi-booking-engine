// JSON-safe value: matches what can round-trip through JSON.stringify/parse,
// which is what the completion message actually is (sent over RabbitMQ as
// JSON, and result/error get written straight into BookingStep's Json
// columns) - Record<string, unknown> was too loose for that and only
// happened to compile before since nothing had written it to the DB yet.
type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

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
  result?: Record<string, JsonValue> | null;
  error?: { code: string; message?: string; retryable: boolean } | null;
};
