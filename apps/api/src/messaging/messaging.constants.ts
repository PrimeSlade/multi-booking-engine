export const RABBITMQ_CONNECTION = Symbol('RABBITMQ_CONNECTION');
export const RABBITMQ_CHANNEL = Symbol('RABBITMQ_CHANNEL');
export const BOOKING_RMQ_CLIENT = 'BOOKING_RMQ_CLIENT';

export const EXCHANGES = {
  BOOKING_TOPIC: 'booking.topic',
  BOOKING_DLX: 'booking.dlx',
} as const;

export const QUEUES = {
  // Orchestration & Resilience
  COMPLETED: 'booking.step.completed',
  DLQ: 'booking.dlq',

  // Step Worker Queues (Stage 0 - Parallel)
  FLIGHT_AVAILABILITY: 'booking.step.flight.availability',
  HOTEL_AVAILABILITY: 'booking.step.hotel.availability',

  // Step Worker Queues (Stage 1 - Sequential)
  FRAUD: 'booking.step.itinerary.fraud',

  // Step Worker Queues (Stage 2 - Parallel / All-or-Ask)
  FLIGHT_ALLOTMENT: 'booking.step.flight.allotment',
  HOTEL_ALLOTMENT: 'booking.step.hotel.allotment',

  // Step Worker Queues (Stage 3 - Sequential)
  PAYMENT: 'booking.step.itinerary.payment',

  // Step Worker Queues (Stage 4 - Sequential)
  NOTIFY: 'booking.step.itinerary.notify',

  // Compensation (saga rollback)
  FLIGHT_ALLOTMENT_COMPENSATE: 'booking.step.compensate.flight.allotment',
  HOTEL_ALLOTMENT_COMPENSATE: 'booking.step.compensate.hotel.allotment',
  PAYMENT_COMPENSATE: 'booking.step.compensate.itinerary.payment',
  COMPENSATED: 'booking.step.compensated',
} as const;

export const ROUTING_PATTERNS = {
  ALL_COMPLETED: 'booking.step.completed.#',
  ALL_COMPENSATE: 'booking.step.compensate.#',
  ALL_COMPENSATED: 'booking.step.compensated.#',
} as const;

// Exact completion routing keys a consumer can @EventPattern() against.
// wildcards is off on the completed queue (see main.ts), so dispatch is
// exact-match only - a wildcard pattern here would never fire. Grows one
// entry at a time as each agent starts publishing completions.
export const COMPLETION_ROUTING_KEYS = {
  FLIGHT_AVAILABILITY: 'booking.step.completed.flight.availability',
  HOTEL_AVAILABILITY: 'booking.step.completed.hotel.availability',
  FRAUD: 'booking.step.completed.itinerary.fraud',
  FLIGHT_ALLOTMENT: 'booking.step.completed.flight.allotment',
  HOTEL_ALLOTMENT: 'booking.step.completed.hotel.allotment',
  PAYMENT: 'booking.step.completed.itinerary.payment',
  NOTIFY: 'booking.step.completed.itinerary.notify',
} as const;

// Same idea as COMPLETION_ROUTING_KEYS, but for "I finished undoing this
// step" events - the orchestrator-side compensated-consumer needs an
// exact-match array to @EventPattern() against for the same wildcards:false
// reason.
export const COMPENSATED_ROUTING_KEYS = {
  FLIGHT_ALLOTMENT: 'booking.step.compensated.flight.allotment',
  HOTEL_ALLOTMENT: 'booking.step.compensated.hotel.allotment',
  PAYMENT: 'booking.step.compensated.itinerary.payment',
} as const;
