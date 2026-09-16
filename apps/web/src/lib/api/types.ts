export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
  path: string;
};

export type Flight = {
  id: string;
  airlineId: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  price: string;
  seatsLeft: number;
};

export type Room = {
  id: string;
  hotelId: string;
  roomType: string;
  price: string;
  available: boolean;
};

export type Hotel = {
  id: string;
  name: string;
  city: string;
  rooms: Room[];
};

export type BookingStep = {
  id: string;
  bookingId: string;
  stepIndex: number;
  stage: number;
  stepName: string;
  scope: string;
  product: string | null;
  agent: string;
  status: string;
};

export type Booking = {
  id: string;
  userId: string;
  status: string;
  products: unknown;
  createdAt: string;
  updatedAt: string;
  steps: BookingStep[];
};

export type FlightProduct = {
  type: 'flight';
  flightId: string;
  flightNumber?: string;
  airlineName?: string;
  origin: string;
  destination: string;
  departureDate: string;
  passengers?: number;
};

export type HotelProduct = {
  type: 'hotel';
  hotelId: string;
  hotelName?: string;
  roomId?: string;
  roomType?: string;
  city: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  rooms?: number;
};

export type CreateBookingPayload = {
  userId: string;
  products: Array<FlightProduct | HotelProduct>;
};

export type SelectedRoom = {
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
};
