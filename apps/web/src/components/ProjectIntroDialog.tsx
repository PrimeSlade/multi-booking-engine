import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ProjectIntroDialogProps = {
  open: boolean;
  onClose: () => void;
};

// Each row is a scenario the mocked agents can produce, and how to trigger it.
// Keep these in sync with the seed data and agent services in apps/api.
const TEST_SCENARIOS = [
  {
    title: 'Fraud check rejected',
    howTo: (
      <>
        Book with a blacklisted email: <Code>ok@email.com</Code> or{' '}
        <Code>slade@email.com</Code>.
      </>
    ),
  },
  {
    title: 'Card declined',
    howTo: (
      <>
        Book with <Code>declined@email.com</Code>. Payment fails after seats and
        rooms are reserved, so you can watch them get released (compensated).
      </>
    ),
  },
  {
    title: 'Partial failure (keep or reject)',
    howTo: (
      <>
        Pick a flight and a hotel room, and tick &quot;Someone else takes
        this&quot; on one of them. A simulated customer takes that item&apos;s
        real inventory right before reserving, so it fails while the rest
        succeeds. You then choose to keep the rest or reject everything. The
        taken seats or rooms stay taken until the database is re-seeded.
      </>
    ),
  },
  {
    title: 'Everything succeeds',
    howTo: <>Use any other email.</>,
  },
];

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

export function ProjectIntroDialog({ open, onClose }: ProjectIntroDialogProps) {
  // Let Escape close the dialog, like most popups.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-intro-title"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg"
        // Clicks inside the dialog should not close it.
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="flex flex-col gap-2 pr-6">
          <h2 id="project-intro-title" className="text-lg font-semibold">
            About this project
          </h2>
          <p className="text-sm text-muted-foreground">
            This is a demo of a multi-booking orchestration engine. It shows how
            one booking with several flights and hotels moves through staged
            steps (availability, fraud check, reservation, payment,
            notification) over RabbitMQ, with retries and automatic rollback
            (compensation) when a step fails.
          </p>
          <p className="text-sm text-muted-foreground">
            It focuses on how the engine works, not on real business workflows
            or polished frontend edge cases. The fraud, payment, and
            notification steps are mocked, and no real card is charged.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Try these scenarios</h3>
          <ul className="flex flex-col gap-2">
            {TEST_SCENARIOS.map((scenario) => (
              <li
                key={scenario.title}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                <p className="font-medium">{scenario.title}</p>
                <p className="mt-0.5 text-muted-foreground">{scenario.howTo}</p>
              </li>
            ))}
          </ul>
        </div>

        <Button onClick={onClose}>Got it, start booking</Button>
      </div>
    </div>
  );
}
