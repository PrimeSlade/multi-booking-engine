import { Plane, BedDouble, Minus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Flight, Hotel, Room, SelectedRoom } from '@/lib/api/types';
import { diffNights, formatCurrency, formatDateTime } from '@/lib/format';

type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; count: number }
  | { status: 'error'; message: string };

function Stepper({
  value,
  onChange,
  min = 1,
  max,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus />
      </Button>
      <span className="w-4 text-center text-sm">{value}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={max !== undefined && value >= max}
        onClick={() =>
          onChange(max === undefined ? value + 1 : Math.min(max, value + 1))
        }
      >
        <Plus />
      </Button>
    </div>
  );
}

export function TripSummary({
  flight,
  passengers,
  onPassengersChange,
  onRemoveFlight,
  rooms,
  onUpdateRoom,
  onRemoveRoom,
  fullName,
  onFullNameChange,
  email,
  onEmailChange,
  onBook,
  bookingState,
}: {
  flight?: Flight;
  passengers: number;
  onPassengersChange: (value: number) => void;
  onRemoveFlight: () => void;
  rooms: Array<{ hotel: Hotel; room: Room; selection: SelectedRoom }>;
  onUpdateRoom: (roomId: string, patch: Partial<SelectedRoom>) => void;
  onRemoveRoom: (roomId: string) => void;
  fullName: string;
  onFullNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  onBook: () => void;
  bookingState: RequestState;
}) {
  const flightTotal = flight ? Number(flight.price) * passengers : 0;
  const hotelTotal = rooms.reduce((sum, { room, selection }) => {
    const nights = diffNights(selection.checkIn, selection.checkOut);
    return sum + Number(room.price) * nights * selection.rooms;
  }, 0);
  const total = flightTotal + hotelTotal;

  const missingDates = rooms.some(
    (r) => !r.selection.checkIn || !r.selection.checkOut,
  );
  const missingDetails = !fullName.trim() || !email.trim();
  const invalidRoomQuantity = rooms.some(
    ({ room, selection }) =>
      selection.rooms < 1 || selection.rooms > room.roomsLeft,
  );
  const disabled =
    missingDates ||
    missingDetails ||
    invalidRoomQuantity ||
    bookingState.status === 'loading' ||
    (!flight && rooms.length === 0);

  return (
    <div className="flex flex-col gap-4">
      {flight && (
        <div className="flex items-start justify-between gap-2 text-sm">
          <div className="flex items-start gap-2">
            <Plane className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {flight.origin} → {flight.destination}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(flight.departureTime)}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Passengers
                </span>
                <Stepper value={passengers} onChange={onPassengersChange} />
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <p className="font-medium">{formatCurrency(flightTotal)}</p>
            <button
              type="button"
              onClick={onRemoveFlight}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remove flight"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {rooms.map(({ hotel, room, selection }) => {
        const nights = diffNights(selection.checkIn, selection.checkOut);
        return (
          <div
            key={room.id}
            className="flex flex-col gap-2 border-t border-border pt-3 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <BedDouble className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {hotel.name} · {room.roomType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hotel.city} · {nights} night{nights > 1 ? 's' : ''}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Rooms</span>
                    <Stepper
                      value={selection.rooms}
                      max={room.roomsLeft}
                      onChange={(value) =>
                        onUpdateRoom(room.id, { rooms: value })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {room.roomsLeft} available
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <p className="font-medium">
                  {formatCurrency(
                    Number(room.price) * nights * selection.rooms,
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => onRemoveRoom(room.id)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove room"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor={`checkIn-${room.id}`} className="text-xs">
                  Check-in
                </Label>
                <Input
                  id={`checkIn-${room.id}`}
                  type="date"
                  className="mt-1"
                  value={selection.checkIn}
                  onChange={(e) =>
                    onUpdateRoom(room.id, { checkIn: e.target.value })
                  }
                />
              </div>
              <div className="flex-1">
                <Label htmlFor={`checkOut-${room.id}`} className="text-xs">
                  Check-out
                </Label>
                <Input
                  id={`checkOut-${room.id}`}
                  type="date"
                  className="mt-1"
                  value={selection.checkOut}
                  onChange={(e) =>
                    onUpdateRoom(room.id, { checkOut: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        );
      })}

      {(flight || rooms.length > 0) && (
        <div className="flex items-center justify-between border-t border-border pt-3 text-sm font-semibold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-3">
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            className="mt-1"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            className="mt-1"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </div>
      </div>

      {bookingState.status === 'error' && (
        <p className="text-sm text-red-600">{bookingState.message}</p>
      )}

      <Button size="lg" disabled={disabled} onClick={onBook} className="w-full">
        {bookingState.status === 'loading' ? 'Booking...' : 'Confirm booking'}
      </Button>
    </div>
  );
}
