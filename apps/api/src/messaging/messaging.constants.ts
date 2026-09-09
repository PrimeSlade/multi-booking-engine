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
} as const;

export const ROUTING_PATTERNS = {
  ALL_COMPLETED: 'booking.step.completed.#',
  ALL_COMPENSATE: 'booking.step.compensate.#',
} as const;
