import { Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Flight } from '@/lib/api/types';
import { formatCurrency, formatDateTime } from '@/lib/format';

export function FlightCard({
  flight,
  selected,
  onSelect,
}: {
  flight: Flight;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`flex items-center justify-between gap-4 p-4 transition-colors ${
        selected ? 'border-primary ring-1 ring-primary' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Plane className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {flight.origin}
            <span className="mx-1.5 text-muted-foreground">→</span>
            {flight.destination}
          </p>
          <p className="text-xs text-muted-foreground">
            {flight.flightNumber} · {formatDateTime(flight.departureTime)}
          </p>
          <p className="text-xs text-muted-foreground">
            {flight.seatsLeft} seats left
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <p className="text-sm font-semibold">{formatCurrency(flight.price)}</p>
        <Button
          size="sm"
          variant={selected ? 'default' : 'outline'}
          onClick={onSelect}
        >
          {selected ? 'Selected' : 'Select'}
        </Button>
      </div>
    </Card>
  );
}
