# Next up

## Build the completion consumer (orchestrator)

Branch: `feat/rabbitmq-agent`. Two increments already done and verified on this branch:

1. **Producer**: `StepDispatchService` (`apps/api/src/dispatch/`) publishes stage-0 `BookingStep`s to the `booking.topic` exchange when a booking is created.
2. **First consumer**: `FlightAvailabilityController`/`Service` (`apps/api/src/agents/flight-availability/`) consumes `flight.availability`, does a real catalog check, acks, and publishes a completion reply to `booking.step.completed.<stepName>`.

### The gap

Nothing reads from `booking.step.completed` yet. Confirmed live: a completion message lands there correctly (proving the binding fix in `main.ts` works), and then NestJS's own `ServerRMQ` code nacks it and logs `An unsupported event was received...` because no `@EventPattern` handler exists for it. The `BookingStep` row in the DB stays `pending` forever, even after a real completion already happened.

### What the orchestrator needs to do

- `@EventPattern` handler(s) on the `booking.step.completed` queue (bound via `ROUTING_PATTERNS.ALL_COMPLETED = 'booking.step.completed.#'` already, in `main.ts`).
- On receiving a `BookingStepCompletionMessage` (`apps/api/src/messaging/messaging.types.ts`): update the matching `BookingStep` row's `status`/`result`/`error` (look it up by `stepId`).
- Decide whether the *stage* is done: does it need to wait for all steps in that `stage` to report back before deciding what's next? (Stage 0 today only has `flight.availability` wired up; `hotel.availability` dispatches into the void since it has no agent yet - decide whether to build `hotel-agent` first, or handle "some steps in a stage never report" as part of this.)
- Apply the stage's `policy`/`join` from the graph (`booking-graph.yml`): stage 2 has `join: all_or_ask` - on partial failure there, `onPartialFailure: awaiting_user_decision` (maps to `Booking.decisionExpiresAt`, `decisionTtlMs: 900000`).
- On success of a stage, dispatch the next stage's steps (this is where `StepDispatchService` might need a more general method than `dispatchStage0`, or a stage-aware variant).
- Compensation is a separate concern layered on top of this (steps have a `compensate` action in the graph, e.g. `release_seat`) - probably its own increment after basic stage advancement works.

### Known gaps to keep in mind (already flagged, not blockers)

- `booking.dlx` is never actually asserted as a real exchange - a nack with no consumer silently drops the message. Not fixed yet.
- Publish-after-ack in the agent has a small window where a crash could lose a completion silently (no orchestrator existed to care until now - might be worth revisiting once one does).

### Suggested approach

Same as the last two increments: go through plan mode first (Explore -> Plan -> confirm scope with me before writing code) since this one has real design decisions (stage advancement, join/barrier logic) rather than just wiring.
