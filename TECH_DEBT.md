# Technical Debt

## Durable retry delay queues remain after backoff changes

**Status:** Open

The retry router creates a durable queue for each worker queue and delay, such as `booking.step.itinerary.notify.retry.1000`. Its `x-message-ttl` expires waiting messages and sends them back to the worker, but it does not delete the delay queue. Reasserting a queue with the same name and settings reuses it.

If a step's `retry.backoffMs` or retry count changes in `booking-graph.yml`, new delay values can create new queues. Old delay queues remain in RabbitMQ after their messages expire, even when the current graph will never use them again. Frequent config changes could leave many empty queues to monitor and manage.

The current graph uses a small set of fixed delays, so cleanup is not required for normal operation. If retry settings become dynamic or change often, add a cleanup strategy for unused delay queues. Any cleanup must first ensure that a queue has no pending retry messages, so it does not discard a scheduled retry.

**Related code:** [RetryRouterService](apps/api/src/messaging/retry-router.service.ts)
