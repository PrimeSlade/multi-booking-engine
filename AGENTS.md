# Agent Guidelines & Project Instructions

## Critical Directive: Code Preservation
- **Source of Truth**: The latest code in the repository is the primary source of truth.
- **Strict Constraint**: Do NOT modify, rewrite, or delete existing code unless explicitly instructed by the user.
- **Additive Development**: Prefer adding new endpoints, handlers, modules, or services without altering working logic unless directly requested.

---

## Project Overview
`multi-booking-engine` is a NestJS-based booking orchestration service utilizing PostgreSQL via Prisma ORM and RabbitMQ for asynchronous step processing.

### Tech Stack
- **Framework**: NestJS (v11)
- **Language**: TypeScript (with strict typing)
- **Database**: PostgreSQL with Prisma ORM
- **Message Broker**: RabbitMQ (`amqp-connection-manager`, `amqplib`)
- **Package Manager**: `pnpm`
- **Code Quality**: ESLint (Flat config), Prettier, Husky, and `lint-staged`

---

## Development Commands

Always use `pnpm` for scripts and package operations:

```bash
# Development
pnpm run start:dev

# Build
pnpm run build

# Linting & Formatting
pnpm run lint
pnpm run format

# Testing
pnpm test
pnpm run test:e2e
```

---

## Git & Commit Standards
- **Commit Format**: Follow Conventional Commits (e.g., `feat:`, `fix:`, `chore:`, `feat(scope):`).
- **Pre-commit Hooks**: Husky runs `lint-staged` automatically on commit to format and lint staged files (`prettier --write` and `eslint --fix`).
- Keep commits atomic and cleanly scoped.
