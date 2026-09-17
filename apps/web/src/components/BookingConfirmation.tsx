import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Booking } from '@/lib/api/types';

const STEP_LABELS: Record<string, string> = {
  'flight.availability': 'Confirming flight availability',
  'hotel.availability': 'Confirming room availability',
  'flight.allotment': 'Reserving flight seat',
  'hotel.allotment': 'Reserving room',
  'itinerary.fraud': 'Running fraud check',
  'itinerary.payment': 'Processing payment',
  'itinerary.notify': 'Sending confirmation',
};

export function BookingConfirmation({
  booking,
  onReset,
}: {
  booking: Booking;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <CheckCircle2 className="size-10 text-emerald-600" />
        <p className="text-base font-semibold">Booking submitted</p>
        <p className="text-sm text-muted-foreground">
          Reference{' '}
          <span className="font-mono text-foreground">{booking.id}</span>
        </p>
        <Badge variant="outline">{booking.status}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {[...booking.steps]
          .sort((a, b) => a.stepIndex - b.stepIndex)
          .map((step) => (
            <div
              key={step.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>{STEP_LABELS[step.stepName] ?? step.stepName}</span>
              <Badge variant="outline">{step.status}</Badge>
            </div>
          ))}
      </div>
      <Button variant="outline" onClick={onReset}>
        Book another trip
      </Button>
    </div>
  );
}
