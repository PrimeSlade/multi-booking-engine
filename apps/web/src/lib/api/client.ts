import axios, { type AxiosInstance } from 'axios';
import type {
  ApiResponse,
  Booking,
  CreateBookingPayload,
  Flight,
  Hotel,
} from '@/lib/api/types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const http: AxiosInstance = axios.create({ baseURL: API_URL });

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>) {
  try {
    const { data } = await promise;
    return data.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const message =
        (err.response?.data as { message?: unknown } | undefined)?.message ??
        err.message;
      throw new Error(
        `${err.response?.status ?? ''} ${String(message)}`.trim(),
      );
    }
    throw err;
  }
}

export function fetchAvailableFlights() {
  return unwrap<Flight[]>(http.get('/flights'));
}

export function fetchAvailableHotels() {
  return unwrap<Hotel[]>(http.get('/hotels'));
}

export function createBooking(payload: CreateBookingPayload) {
  return unwrap<Booking>(http.post('/bookings', payload));
}
