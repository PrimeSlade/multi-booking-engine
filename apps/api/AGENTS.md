# Backend Agent Guidelines (apps/api)

## Critical Directive: Code Preservation
- **Source of Truth**: The latest code in `apps/api` is the source of truth for the backend service.
- **Strict Constraint**: Do NOT modify, rewrite, or delete existing endpoints, services, controllers, DTOs, or database schemas unless explicitly instructed by the user.
- **Additive Development**: Add new handlers, controllers, modules, or workflow steps additively without altering working functionality.

---

## Service Overview
`@booking/api` is the backend orchestration service for the multi-booking engine.

### Tech Stack
- **Framework**: NestJS (v11)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with Prisma ORM
- **Messaging**: RabbitMQ (`amqp-connection-manager`, `amqplib`) for asynchronous step execution
- **Validation**: `class-validator`, `class-transformer` with global `ValidationPipe`

---

## Data Architecture & Workflow
- **Prisma Schema**: Located in [apps/api/prisma/schema.prisma](file:///Users/saizayarhein/Desktop/mutli-booking-engine/apps/api/prisma/schema.prisma)
  - `Booking`: Represents overall itinerary booking with status (`in_progress`, `awaiting_user_decision`, `partially_confirmed`, `confirmed`, `failed`).
  - `BookingStep`: Represents individual steps in the workflow with status (`pending`, `in_progress`, `success`, `failed`, `compensating`, `compensated`).
  - Idempotency guard: `@@unique([bookingId, stepName])`.

---

## Development Commands

Run these commands within `apps/api` (or from root using `pnpm --filter @booking/api <command>`):

```bash
# Start development server
pnpm run start:dev

# Build compiled output
pnpm run build

# Linting & Formatting
pnpm run lint
pnpm run format

# Testing
pnpm test
pnpm run test:e2e

# Database & Migrations
pnpm run prisma:generate
pnpm run prisma:migrate
```

---

## Coding Standards
1. **DTOs**: Every incoming request must be validated using typed DTOs with `class-validator` decorators.
2. **Modular Architecture**: Separate concerns cleanly between Controllers, Services, and Modules.
3. **Error Handling**: Use NestJS built-in HTTP exceptions and structured error responses.
4. **Resilience**: Ensure RabbitMQ step messages and DB transactions handle idempotent retries and compensations gracefully.
