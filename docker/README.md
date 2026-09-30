# Dokploy deployment

Create a Docker Compose service in Dokploy with compose path `./docker-compose.dokploy.yml` and the repository root as the build context. Set these environment variables in the Compose service:

```text
POSTGRES_PASSWORD=<strong database password>
RABBITMQ_PASSWORD=<strong RabbitMQ password>
DATABASE_URL=postgresql://booking:<URL-encoded database password>@postgres:5432/booking_engine?schema=public
RABBITMQ_URL=amqp://booking:<URL-encoded RabbitMQ password>@rabbitmq:5672
```

The password values in the URLs must match the corresponding password variables. URL-encode reserved characters in the URLs. The migration service applies pending migrations before the API starts.

In the Dokploy Compose service's Domains tab, add a domain for the `web` service on container port `80`. The web server serves the frontend and forwards API requests, including `/api` Swagger, to the private API service. Only `web` joins `dokploy-network`; PostgreSQL, RabbitMQ, and the API have no published ports.

For Docker testing, build and run on the Oracle VM over SSH and use an SSH local forward to reach the test web port. Do not run Docker on the local device.
