# Frontend Agent Guidelines (apps/web)

## Critical Directive: Code Preservation
- **Source of Truth**: The latest code in `apps/web` is the source of truth for the frontend client.
- **Strict Constraint**: Do NOT modify, rewrite, or delete existing UI components, state management, or styling unless explicitly instructed by the user.
- **Additive Development**: Add new components, pages, hooks, or API client methods additively without altering existing working views.

---

## Application Overview
`@booking/web` is a minimal, lightweight React frontend application for interacting with and monitoring the Multi-Booking Engine.

### Tech Stack
- **Framework / Bundler**: React (v19) with Vite
- **Language**: TypeScript (strict mode)
- **Styling**: Modern CSS modules / standard CSS
- **Code Quality**: ESLint (Flat config) + TypeScript-ESLint + Prettier

---

## Development Commands

Run these commands within `apps/web` (or from root using `pnpm --filter @booking/web <command>`):

```bash
# Start local development server (default: http://localhost:5173)
pnpm run dev

# Type check & build production bundle
pnpm run build

# Preview production build locally
pnpm run preview

# Linting
pnpm run lint
```

---

## Frontend Architecture & Conventions
1. **Component Design**:
   - Use React functional components with TypeScript interfaces for `props`.
   - Keep state local where possible; use custom hooks for shared logic.
2. **API Communication**:
   - Communicate with the backend API (`@booking/api`) via typed client functions or service modules.
   - Handle loading, error, and success states explicitly for booking actions.
3. **Consistency**:
   - Maintain uniform styling and typography across components.
   - Strictly type all data structures returned by the booking API.
