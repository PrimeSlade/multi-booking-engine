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
  roomsLeft: number;
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
  flightBookingId: string | null;
  hotelBookingId: string | null;
  stepIndex: number;
  stage: number;
  stepName: string;
  scope: string;
  agent: string;
  status: string;
};

export type FlightBooking = {
  id: string;
  bookingId: string;
  flightId: string;
  flightNumber: string | null;
  origin: string;
  destination: string;
  departureDate: string;
  passengers: number;
};

export type HotelBooking = {
  id: string;
  bookingId: string;
  hotelId: string;
  hotelName: string | null;
  roomId: string | null;
  roomType: string | null;
  city: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
};

export type Booking = {
  id: string;
  userId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  flightBookings: FlightBooking[];
  hotelBookings: HotelBooking[];
  steps: BookingStep[];
};

export type FlightProduct = {
  type: 'flight';
  flightId: string;
  flightNumber?: string;
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
  rooms: number;
};
