# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server (Next.js)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

No test runner is configured. Use `npm run lint` to catch type/style issues.

## Architecture

**Stack**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + Prisma + MongoDB

**What this is**: A B2B support operations dashboard for a team using Intercom. It tracks agent performance, client health, shifts, handovers, and strategic goals.

### Key directories

- `src/app/` — Next.js App Router pages. Pages are mostly Server Components that fetch data from Prisma/external APIs and pass it to Client Components.
- `src/components/dashboard/` — 40+ feature-specific dashboard components (KPIs, charts, kanban, leaderboard, etc.)
- `src/components/layout/` — `AppShell.tsx` wraps the entire app (sidebar + header + content). Auth pages bypass the shell.
- `src/components/ui/` — shadcn/ui base components (never modify these directly).
- `src/lib/` — Server-side logic: `actions.ts` (server actions for automations/backlog/goals), `intercom.ts` (Intercom API), `prisma.ts` (singleton client), `slack.ts` / `slackNotifications.ts`, `sseRegistry.ts` (SSE for live events).
- `src/hooks/` — `useLiveEvents.ts` for consuming SSE streams.
- `src/types/` — `dashboard.ts` (shared types), `next-auth.d.ts` (session augmentation).
- `src/middleware.ts` — Protects all routes except `/login` and `/register`.

### Data flow

Pages in `src/app/` use `async/await` with `Promise.all()` for parallel Prisma queries, then render Server Components directly. Interactive features are Client Components (`"use client"`). Server Actions in `src/lib/actions.ts` handle mutations (backlog, automations, goals).

### External integrations

- **Intercom**: Primary data source for agent metrics and conversation data. Webhooks at `src/app/api/webhooks/intercom/` (sync + stream).
- **Google Calendar**: Webhook integration for shift/event management.
- **Slack**: Outgoing webhook notifications via `src/lib/slack.ts`.

### Styling

- Tailwind CSS v4 with `@import` syntax in `globals.css` (not `@tailwind` directives).
- Design system: dark-first, primary accent `#7bd21e` (lime green), 8px border radius, Inter font.
- Dark mode via `.dark` class (next-themes).
- Use `cn()` from `src/lib/utils.ts` for conditional class merging (clsx + tailwind-merge).
- shadcn/ui components use `new-york` style with `neutral` base color.

### Auth

NextAuth v4 with Prisma adapter and JWT strategy. Session includes `user.id` and `user.role`. Role-based access used for admin routes (`/admin/*`).

### Path aliases

`@/*` maps to `src/*`. Always use this alias for imports.

## Variables de entorno adicionales

- `CRON_SECRET` — Token secreto para el endpoint `/api/cron/knowledge-sync`
- `APP_URL` — URL base de la app (default: http://localhost:3000), usada por el cron script

## Cron nocturno (KB sync)

```bash
node scripts/cron-knowledge.mjs   # Iniciar como proceso separado
```
