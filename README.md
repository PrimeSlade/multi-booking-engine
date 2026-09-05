# Multi-Booking Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.13-FF6600?logo=rabbitmq)](https://www.rabbitmq.com/)
[![Docker](https://img.shields.io/badge/Docker-24+-2496ED?logo=docker)](https://www.docker.com/)
[![pnpm](https://img.shields.io/badge/pnpm-10+-F69220?logo=pnpm)](https://pnpm.io/)

A distributed, multi-product booking orchestration engine designed to coordinate complex, multi-step booking workflows (e.g., hotels, flights) with transactional integrity, asynchronous step routing, and compensating actions (Saga pattern).

> [!NOTE]
> **Project Scope**: This project is **not** a full travel platform or end-to-end booking site. It focuses exclusively on the core **orchestration engine** behind multi-product bookings — managing complex distributed lifecycles, staged execution graphs, asynchronous message queues, idempotency, and saga-pattern compensations.

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
