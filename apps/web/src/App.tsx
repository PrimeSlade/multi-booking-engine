import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FlightCard } from '@/components/FlightCard';
import { HotelCard } from '@/components/HotelCard';
import { TripSummary } from '@/components/TripSummary';
import { BookingConfirmation } from '@/components/BookingConfirmation';
import {
  createBooking,
  fetchAvailableFlights,
  fetchAvailableHotels,
  fetchBooking,
  submitBookingDecision,
} from '@/lib/api/client';
import type {
  Booking,
  BookingDecision,
  Flight,
  FlightProduct,
  Hotel,
  HotelProduct,
  SelectedRoom,
} from '@/lib/api/types';

type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; count: number }
  | { status: 'error'; message: string };

type Tab = 'flights' | 'hotels';

const TERMINAL_STEP_STATUSES = new Set(['success', 'failed', 'compensated']);
const BOOKING_POLL_INTERVAL_MS = 2000;

export function App() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('flights');
  const [query, setQuery] = useState('');

  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<SelectedRoom[]>([]);

  const [passengers, setPassengers] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  const [bookingState, setBookingState] = useState<RequestState>({
    status: 'idle',
  });
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(
    null,
  );

  useEffect(() => {
    async function load() {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [flightData, hotelData] = await Promise.all([
          fetchAvailableFlights(),
          fetchAvailableHotels(),
        ]);
        console.log('[Flights]', flightData);
        console.log('[Hotels]', hotelData);
        setFlights(flightData);
        setHotels(hotelData);
      } catch (err) {
        setCatalogError(
          err instanceof Error ? err.message : 'Failed to load catalog',
        );
      } finally {
        setCatalogLoading(false);
      }
    }
    void load();
  }, []);

  // The confirmation page shows step statuses, but createBooking's response
  // is a one-time snapshot from the moment the booking was submitted - the
  // orchestrator updates step statuses asynchronously afterward via
  // RabbitMQ, so without re-fetching, the UI stays frozen on "pending"
  // forever even after steps actually succeed or fail. Poll until every
  // step reaches a terminal status.
  useEffect(() => {
    if (!confirmedBooking) return;
    if (
      confirmedBooking.steps.every((step) =>
        TERMINAL_STEP_STATUSES.has(step.status),
      )
    ) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const fresh = await fetchBooking(confirmedBooking.id);
        if (!cancelled) setConfirmedBooking(fresh);
      } catch (err) {
        console.error('[Booking poll]', err);
      }
    }, BOOKING_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [confirmedBooking]);

  const selectedFlight = flights.find((f) => f.id === selectedFlightId);

  const roomEntries = useMemo(
    () =>
      selectedRooms
        .map((selection) => {
          const hotel = hotels.find((h) => h.id === selection.hotelId);
          const room = hotel?.rooms.find((r) => r.id === selection.roomId);
          return hotel && room ? { hotel, room, selection } : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    [selectedRooms, hotels],
  );

  const filteredFlights = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flights;
    return flights.filter(
      (f) =>
        f.origin.toLowerCase().includes(q) ||
        f.destination.toLowerCase().includes(q) ||
        f.flightNumber.toLowerCase().includes(q),
    );
  }, [flights, query]);

  const filteredHotels = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hotels;
    return hotels.filter(
      (h) =>
        h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q),
    );
  }, [hotels, query]);

  const toggleRoom = (hotelId: string, roomId: string) => {
    setSelectedRooms((current) => {
      if (current.some((r) => r.roomId === roomId)) {
        return current.filter((r) => r.roomId !== roomId);
      }
      return [
        ...current,
        { hotelId, roomId, checkIn: '', checkOut: '', rooms: 1 },
      ];
    });
  };

  const updateRoom = (roomId: string, patch: Partial<SelectedRoom>) => {
    setSelectedRooms((current) =>
      current.map((r) => (r.roomId === roomId ? { ...r, ...patch } : r)),
    );
  };

  const removeRoom = (roomId: string) => {
    setSelectedRooms((current) => current.filter((r) => r.roomId !== roomId));
  };

  const handleBook = async () => {
    const products: Array<FlightProduct | HotelProduct> = [];

    if (selectedFlight) {
      products.push({
        type: 'flight',
        flightId: selectedFlight.id,
        flightNumber: selectedFlight.flightNumber,
        origin: selectedFlight.origin,
        destination: selectedFlight.destination,
        departureDate: new Date(selectedFlight.departureTime).toISOString(),
        passengers,
      });
    }

    for (const { hotel, room, selection } of roomEntries) {
      products.push({
        type: 'hotel',
        hotelId: hotel.id,
        hotelName: hotel.name,
        roomId: room.id,
        roomType: room.roomType,
        city: hotel.city,
        checkIn: new Date(selection.checkIn).toISOString(),
        checkOut: new Date(selection.checkOut).toISOString(),
        rooms: selection.rooms,
      });
    }

    setBookingState({ status: 'loading' });
    try {
      const booking = await createBooking({ userId: email, products });
      console.log('[Booking]', booking);
      setBookingState({ status: 'success', count: booking.steps.length });
      setConfirmedBooking(booking);
    } catch (err) {
      console.error('[Booking]', err);
      setBookingState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Request failed',
      });
    }
  };

  const handleReset = () => {
    setConfirmedBooking(null);
    setBookingState({ status: 'idle' });
    setSelectedFlightId(null);
    setSelectedRooms([]);
    setPassengers(1);
  };

  const handleBookingDecision = async (decision: BookingDecision) => {
    if (!confirmedBooking) return;
    await submitBookingDecision(confirmedBooking.id, decision);
    const fresh = await fetchBooking(confirmedBooking.id);
    setConfirmedBooking(fresh);
  };

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Book your trip
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search flights and hotels, then confirm your itinerary. Add as many
          hotel stays as your trip needs.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-fit rounded-md border border-border bg-card p-1">
              <Button
                size="sm"
                variant={tab === 'flights' ? 'default' : 'ghost'}
                onClick={() => setTab('flights')}
              >
                Flights
              </Button>
              <Button
                size="sm"
                variant={tab === 'hotels' ? 'default' : 'ghost'}
                onClick={() => setTab('hotels')}
              >
                Hotels
              </Button>
            </div>
            <Input
              placeholder={
                tab === 'flights'
                  ? 'Search by airport or flight number'
                  : 'Search by hotel or city'
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:w-64"
            />
          </div>

          {catalogError && (
            <p className="text-sm text-red-600">{catalogError}</p>
          )}

          {catalogLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tab === 'flights'
                ? filteredFlights.map((flight) => (
                    <FlightCard
                      key={flight.id}
                      flight={flight}
                      selected={selectedFlightId === flight.id}
                      onSelect={() =>
                        setSelectedFlightId((current) =>
                          current === flight.id ? null : flight.id,
                        )
                      }
                    />
                  ))
                : filteredHotels.map((hotel) => (
                    <HotelCard
                      key={hotel.id}
                      hotel={hotel}
                      selectedRoomIds={selectedRooms
                        .filter((r) => r.hotelId === hotel.id)
                        .map((r) => r.roomId)}
                      onToggleRoom={(roomId) => toggleRoom(hotel.id, roomId)}
                    />
                  ))}
            </div>
          )}
        </div>

        <div className="min-w-0 md:sticky md:top-10 md:self-start">
          <Card>
            <CardHeader>
              <CardTitle>
                {confirmedBooking ? 'Confirmation' : 'Trip summary'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {confirmedBooking ? (
                <BookingConfirmation
                  booking={confirmedBooking}
                  onDecision={handleBookingDecision}
                  onReset={handleReset}
                />
              ) : selectedFlight || roomEntries.length > 0 ? (
                <TripSummary
                  flight={selectedFlight}
                  passengers={passengers}
                  onPassengersChange={setPassengers}
                  onRemoveFlight={() => setSelectedFlightId(null)}
                  rooms={roomEntries}
                  onUpdateRoom={updateRoom}
                  onRemoveRoom={removeRoom}
                  fullName={fullName}
                  onFullNameChange={setFullName}
                  email={email}
                  onEmailChange={setEmail}
                  onBook={handleBook}
                  bookingState={bookingState}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a flight or add a room to start your booking.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default App;
