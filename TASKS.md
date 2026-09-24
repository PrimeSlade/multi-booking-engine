# Remaining work

## Finish the main booking features

- Build the hotel allotment agent, including `release_room` compensation.
- Implement the stage-2 `all_or_ask` partial-failure flow, including `awaiting_user_decision` and `decisionExpiresAt`.
- Implement explicit user approval and rejection handling plus the decision-timeout path.

## Deferred: compensation reliability, retries, and recovery

Complete the remaining main booking features before starting this increment. The current compensation flow can leave a `BookingStep` stuck in `compensating` when dispatching the compensation command fails, the agent acknowledges the command before publishing its `compensated` event, or the event never reaches the orchestrator.

### Required reliability work

- Make every compensation operation idempotent by `stepId`; redelivery must not release the same seat, room, or payment more than once.
- Publish the `booking.step.compensated.<stepName>` result successfully before acknowledging the compensation command.
- Add bounded RabbitMQ retry queues with backoff for failed compensation commands and result publication.
- Route exhausted retries to an asserted DLX/DLQ with an observable consumer or inspection path.
- Add a watchdog for `BookingStep` rows that remain `compensating` past their configured timeout, then safely redispatch them.
- Consider a transactional outbox for atomic database state changes and outbound compensation events.

### Test coverage

- Compensation succeeds but publishing its result fails.
- A consumer crashes after publishing the result but before acknowledging the command.
- RabbitMQ redelivers a compensation command and the domain action remains idempotent.
- Retry limits and backoff are enforced, then exhausted messages reach the DLQ.
- The watchdog recovers a stale `compensating` step without duplicating the compensation action.
