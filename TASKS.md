# Remaining work

## Deferred: compensation reliability, retries, and recovery

The compensation flow is implemented: successful compensatable steps are claimed, compensation commands are dispatched, and `compensated` events update their `BookingStep` rows. This is sufficient for the experimental version. The reliability work below is deferred. A step can still stay `compensating` if command dispatch fails, an agent acknowledges its command before publishing the result, or the result never reaches the orchestrator.

### Required reliability work

- Make every compensation operation idempotent by `stepId`; redelivery must not release the same seat, room, or payment more than once.
- Publish the `booking.step.compensated.<stepName>` result successfully before acknowledging the compensation command.
- After primary worker retries are available, add bounded compensation-specific retries with backoff for failed commands and result publication. Keep rollback actions idempotent before enabling redelivery.
- Route exhausted retries to an asserted DLX/DLQ with an observable consumer or inspection path.
- Add a watchdog for `BookingStep` rows that remain `compensating` past their configured timeout, then safely redispatch them.
- Consider a transactional outbox for atomic database state changes and outbound compensation events.

### Test coverage

- Compensation succeeds but publishing its result fails.
- A consumer crashes after publishing the result but before acknowledging the command.
- RabbitMQ redelivers a compensation command and the domain action remains idempotent.
- Retry limits and backoff are enforced, then exhausted messages reach the DLQ.
- The watchdog recovers a stale `compensating` step without duplicating the compensation action.

## Future: update booking graph YAML through an API endpoint

The booking graph is currently read from `booking-graph.yml` at startup. Add an admin endpoint that validates a proposed graph against `BookingGraphSchema`, writes the YAML safely, and makes the accepted version available to new bookings without changing in-flight bookings.

### Acceptance checks

- Reject invalid graph content without changing the active graph or YAML file.
- Require admin authorization for updates.
- Persist and activate a valid version consistently, including after an API restart.
- Document the update request and response, and test that in-flight bookings keep their existing graph snapshot.
