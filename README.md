# Multi-Booking Engine

A distributed, multi-product booking orchestration engine designed to coordinate complex, multi-step booking workflows (e.g., hotels, flights) with transactional integrity, asynchronous step routing, and compensating actions (Saga pattern).

---

## Overview

The **Multi-Booking Engine** processes multi-product travel bookings through a staged execution graph. Each booking generates discrete lifecycle steps (`availability`, `fraud`, `payment`, `allotment`, `notify`) that are dispatched asynchronously across RabbitMQ message queues and tracked in PostgreSQL via Prisma ORM for idempotency, automatic retries, and compensation on failure.

The repository is structured as a **pnpm monorepo** containing both the NestJS orchestration backend and a minimal React client.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend (`apps/api`)** | [NestJS 11](https://nestjs.com/), TypeScript, [Prisma ORM](https://www.prisma.io/), `class-validator`, `class-transformer` |
| **Frontend (`apps/web`)** | [React 19](https://react.dev/), [Vite](https://vitejs.dev/), TypeScript |
| **Message Broker** | [RabbitMQ 3.13](https://www.rabbitmq.com/) (`amqp-connection-manager`, `amqplib`) |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) |
| **Monorepo & Tooling** | `pnpm` Workspaces, Docker Compose, ESLint (Flat Config), Prettier, Husky, `lint-staged` |

---

## Monorepo Architecture

```text
.
├── apps/
│   ├── api/                    # NestJS Orchestration Service (@booking/api)
│   │   ├── prisma/             # Schema & PostgreSQL migrations
│   │   ├── src/                # Controllers, services, modules, & DTOs
│   │   ├── test/               # Unit & E2E tests
│   │   └── AGENTS.md           # Backend agent instructions
│   │
│   └── web/                    # Minimal React UI (@booking/web)
│       ├── src/                # React components, styles, and client entry
│       ├── vite.config.ts
│       └── AGENTS.md           # Frontend agent instructions
│
├── docker-compose.yml          # PostgreSQL & RabbitMQ services
├── pnpm-workspace.yaml         # pnpm workspace definition
├── package.json                # Monorepo root scripts & git hooks
├── AGENTS.md                   # Monorepo root guidelines
└── README.md
```

---

## Getting Started

### Prerequisites
- **Node.js**: `v20+` or `v22+`
- **pnpm**: `v10+`
- **Docker** & **Docker Compose**

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Infrastructure
Launch PostgreSQL and RabbitMQ containers:
```bash
docker-compose up -d
```
- **PostgreSQL**: `localhost:5432` (`booking_engine`)
- **RabbitMQ AMQP**: `localhost:5672`
- **RabbitMQ Management UI**: `http://localhost:15672` (User: `guest` / Pass: `guest`)

### 3. Configure Environment
Copy `.env.example` to `.env` in `apps/api/`:
```bash
cp apps/api/.env.example apps/api/.env
```

### 4. Run Database Migrations
Apply Prisma migrations to the PostgreSQL database:
```bash
pnpm --filter @booking/api prisma:migrate
```

### 5. Start Development Servers
```bash
# Run both Backend and Frontend concurrently
pnpm dev

# Or run services individually
pnpm dev:api    # NestJS API -> http://localhost:3000
pnpm dev:web    # React Web  -> http://localhost:5173
```

---

## Available Scripts

All scripts can be executed from the monorepo root:

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Starts both `api` and `web` concurrently |
| `pnpm dev:api` | Starts the NestJS backend with watch mode |
| `pnpm dev:web` | Starts the Vite React frontend |
| `pnpm build` | Builds all packages (`api` and `web`) in topological order |
| `pnpm build:api` | Compiles the NestJS backend (`nest build`) |
| `pnpm build:web` | Compiles the React frontend (`tsc -b && vite build`) |
| `pnpm lint` | Lints all packages with ESLint |
| `pnpm format` | Formats codebase with Prettier |
| `pnpm test` | Runs backend unit tests |

---

## Workflow & Step Lifecycle

The engine coordinates bookings via stateful stages:
1. **Initiate Booking**: Validates input products (`hotel`, `flight`) and saves `Booking` record in `in_progress` status.
2. **Step Execution**: Generates sequential and parallel steps (`BookingStep`) routed to target agents via RabbitMQ.
3. **Status Transitions**: `pending` $\rightarrow$ `in_progress` $\rightarrow$ `success` / `failed`.
4. **Compensation**: In case of failures or partial allotments, triggers compensating transactions (`compensating` $\rightarrow$ `compensated`).

---

## Code Quality & Pre-commit Hooks

- **Husky** and **lint-staged** are configured in the root repository.
- On each `git commit`, staged TypeScript/JavaScript files are automatically formatted with Prettier and checked with ESLint before the commit is finalized.
