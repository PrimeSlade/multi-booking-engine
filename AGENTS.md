# Root Agent Guidelines & Monorepo Instructions

## Critical Directive: Code Preservation
- **Source of Truth**: The latest code in the repository is the primary source of truth.
- **Strict Constraint**: Do NOT modify, rewrite, or delete existing code unless explicitly instructed by the user.
- **Additive Development**: Prefer adding new endpoints, components, modules, or services without altering working logic unless directly requested.

---

## Monorepo Overview
This project is a `pnpm` workspace monorepo containing the following applications:

```text
.
├── apps/
│   ├── api/          # NestJS backend (Booking Orchestration Engine)
│   └── web/          # Minimal React + Vite frontend
├── docker-compose.yml # Shared Postgres & RabbitMQ infrastructure
├── pnpm-workspace.yaml
├── package.json
└── AGENTS.md          # Monorepo root guidelines
```

---

## Directory-Level Agent Guidelines
Detailed domain instructions are maintained within each app's directory level:
- **Backend Guidelines**: See [apps/api/AGENTS.md](file:///Users/saizayarhein/Desktop/mutli-booking-engine/apps/api/AGENTS.md) for NestJS, Prisma, PostgreSQL, and RabbitMQ standards.
- **Frontend Guidelines**: See [apps/web/AGENTS.md](file:///Users/saizayarhein/Desktop/mutli-booking-engine/apps/web/AGENTS.md) for React, Vite, and UI standards.

---

## Monorepo Development Commands

Always use `pnpm` from the monorepo root:

```bash
# Install all dependencies across workspaces
pnpm install

# Run development servers
pnpm dev              # Run both api and web concurrently
pnpm dev:api          # Run NestJS backend only
pnpm dev:web          # Run React frontend only

# Build all applications
pnpm build            # Build all packages in topological order
pnpm build:api        # Build backend only
pnpm build:web        # Build frontend only

# Linting
pnpm lint             # Lint all workspace packages

# Infrastructure (PostgreSQL + RabbitMQ)
docker-compose up -d
docker-compose down
```

---

## Git & Commit Standards
- **Commit Format**: Follow Conventional Commits with scope prefixes:
  - `feat(api):` or `fix(api):` for backend changes
  - `feat(web):` or `fix(web):` for frontend changes
  - `feat(infra):` for Docker / environment changes
  - `chore(monorepo):` or `docs:` for root / documentation updates
- **Pre-commit Hooks**: Husky runs `lint-staged` on staged files before each commit.
- **No AI Attribution**: Do not add `Co-Authored-By` or any other AI attribution line to commit messages or PR descriptions.

---

## TypeScript Standards
- **Prefer `type` over `interface`**: Consistently use `type` aliases rather than `interface` for object models, schema types, and data structures across both applications (`apps/api` and `apps/web`).

---

## Writing Style
- **No em dashes**: Do not use the em dash (—) in code comments, commit messages, docs, or any written output. Use a comma, period, or parentheses instead.
