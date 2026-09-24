import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Booking, BookingDecision } from '@/lib/api/types';

const STEP_LABELS: Record<string, string> = {
  'flight.availability': 'Confirming flight availability',
  'hotel.availability': 'Confirming room availability',
  'flight.allotment': 'Reserving flight seat',
  'hotel.allotment': 'Reserving room',
  'itinerary.fraud': 'Running fraud check',
  'itinerary.payment': 'Processing payment',
  'itinerary.notify': 'Sending confirmation',
};

function stepBadgeVariant(status: string) {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'destructive';
  return 'outline';
}

export function BookingConfirmation({
  booking,
  onDecision,
  onReset,
}: {
  booking: Booking;
  onDecision: (decision: BookingDecision) => Promise<void>;
  onReset: () => void;
}) {
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const allotmentSteps = booking.steps.filter((step) =>
    step.stepName.endsWith('.allotment'),
  );
  const successfulAllotments = allotmentSteps.filter(
    (step) => step.status === 'success',
  ).length;
  const failedAllotments = allotmentSteps.filter(
    (step) => step.status === 'failed',
  ).length;

  const decide = async (decision: BookingDecision) => {
    setDecisionLoading(true);
    setDecisionError(null);
    try {
      await onDecision(decision);
    } catch (err) {
      setDecisionError(
        err instanceof Error ? err.message : 'Decision request failed',
      );
    } finally {
      setDecisionLoading(false);
    }
  };

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4">
      <div className="flex min-w-0 flex-col items-center gap-2 py-2 text-center">
        <CheckCircle2 className="size-10 text-emerald-600" />
        <p className="text-base font-semibold">Booking submitted</p>
        <p className="max-w-full text-sm text-muted-foreground">
          Reference{' '}
          <span className="break-all font-mono text-foreground">
            {booking.id}
          </span>
        </p>
        <Badge variant="outline">{booking.status}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {[...booking.steps]
          .sort((a, b) => a.stepIndex - b.stepIndex)
          .map((step) => (
            <div
              key={step.id}
              className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="min-w-0 break-words">
                {STEP_LABELS[step.stepName] ?? step.stepName}
              </span>
              <Badge
                className="shrink-0"
                variant={stepBadgeVariant(step.status)}
              >
                {step.status}
              </Badge>
            </div>
          ))}
      </div>
      {booking.status === 'awaiting_user_decision' && (
        <div className="flex min-w-0 flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <div className="min-w-0 break-words">
            <p className="font-medium">Some reservations are unavailable</p>
            <p className="mt-1 text-xs">
              {successfulAllotments} succeeded and {failedAllotments} failed.
              Keep every successful reservation or reject the entire booking.
            </p>
            {booking.decisionExpiresAt && (
              <p className="mt-1 text-xs">
                Decision required by{' '}
                {new Date(booking.decisionExpiresAt).toLocaleString()}.
              </p>
            )}
          </div>
          {decisionError && (
            <p className="break-words text-xs text-red-700">{decisionError}</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={decisionLoading}
              onClick={() => void decide('accept_partial')}
              className="h-auto min-w-0 flex-1 whitespace-normal py-2"
            >
              Keep successful bookings
            </Button>
            <Button
              disabled={decisionLoading}
              variant="outline"
              onClick={() => void decide('reject_all')}
              className="h-auto min-w-0 flex-1 whitespace-normal py-2"
            >
              Reject everything
            </Button>
          </div>
        </div>
      )}
      <Button variant="outline" onClick={onReset}>
        Book another trip
      </Button>
    </div>
  );
}
