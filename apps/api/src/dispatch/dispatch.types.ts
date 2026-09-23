export type BookingStepDispatchMessage = {
  stepId: string;
  bookingId: string;
  stepName: string;
  scope: 'product' | 'itinerary';
  agent: string;
  flightBookingId: string | null;
  hotelBookingId: string | null;
  attempt: number;
  timeoutMs: number;
  retry: { max: number; backoffMs: number };
};

export type BookingStepCompensateMessage = {
  stepId: string;
  bookingId: string;
  stepName: string;
  scope: 'product' | 'itinerary';
  agent: string;
  flightBookingId: string | null;
  hotelBookingId: string | null;
};
