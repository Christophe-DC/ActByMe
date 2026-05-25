# ActByMe — AGENTS guidelines for AI coding agents

Purpose: provide clear, actionable rules and conventions for AI coding agents contributing to the ActByMe repository.

## Project overview

- ActByMe is an actor-first marketplace focusing on actor registration, public profiles, video portfolios, and agency access requests.
- The MVP goal is to attract and showcase actors and let agencies request access.

## Actor-first MVP strategy

- Prioritize actor registration and public profiles with video portfolios.
- Keep product scope minimal: no payments, no client dashboards, no downloadable final videos in the MVP.
- Privacy: private videos must remain private; public portfolios must be explicitly published by the actor.

## Monorepo structure

- apps/web — Next.js App Router frontend (React + TypeScript)
- apps/api — NestJS backend API (TypeScript)
- packages/database — Prisma schema, migrations, seed, generated client
- packages/shared — shared enums, DTOs, Zod schemas
- packages/ui — shared UI primitives and components

## Tech stack

- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS
- Backend: NestJS, TypeScript
- Database: PostgreSQL, Prisma
- Packaging: pnpm, Turbo (monorepo tasks)

## Coding conventions

- Default to TypeScript for all packages.
- Prefer clear, descriptive names for functions and types (no one-letter variables).
- Keep changes minimal and focused to the requested task.
- Add unit tests for non-trivial logic; prefer small, isolated tests.
- Run `pnpm format`, `pnpm lint`, and `pnpm typecheck` before opening PRs.

## Folder & file naming conventions

- Use `kebab-case` for filenames and folders in the frontend (e.g., `actor-profile.tsx`).
- Use `camelCase` for JS/TS identifiers; `PascalCase` for React components and classes.
- API modules live under `apps/api/src/<module-name>` with `*.module.ts`, `*.controller.ts`, `*.service.ts`.
- Shared types and DTOs live in `packages/shared/src`.

## UI design rules — Cinematic Dark theme

- Theme name: Cinematic Dark. Use deep, desaturated blacks and warm highlights.
- Primary background: #0b0b0d, surface cards: #111214.
- Accent color: warm amber or cinematic gold (use Tailwind config token `--accent` or equivalent).
- Typography: high contrast headings, readable body type, generous leading for captions.
- Motion: subtle, short transitions (50–200ms); prefer scale + fade for cinematic feel.
- Accessibility: ensure 4.5:1 contrast for body text, 3:1 for large display text.

## How to run the project locally

1. Install dependencies: `pnpm install` at repo root.
2. Create local env: copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Start PostgreSQL (local or Docker) and create the `actbyme` DB.
4. Generate Prisma client: `pnpm db:generate`.
5. Run migrations: `pnpm db:migrate`.
6. Start development: `pnpm dev` (turbo will run apps).

## Lint, typecheck and tests

- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Format: `pnpm format`
- Tests: add per-package test scripts; run them from root with `pnpm -w test` if configured.

## How to add a new frontend page (apps/web)

1. Use Next.js App Router conventions: create a route under `apps/web/app/`, e.g. `apps/web/app/actors/[slug]/page.tsx`.
2. Export an async `generateMetadata` and default `Page` React component.
3. Add route-specific data fetching with server components and the shared Prisma client when needed.
4. Add styles to `apps/web/app/globals.css` or create a module CSS file.
5. Update navigation or components in `packages/ui` if needed.

## How to add a new NestJS API module (apps/api)

1. Create a folder `apps/api/src/<module-name>`.
2. Add `<module-name>.module.ts`, `<module-name>.controller.ts`, `<module-name>.service.ts` following existing patterns.
3. Register the module in `apps/api/src/app.module.ts`.
4. Add DTOs in `packages/shared` and import them into the API.
5. Add unit/e2e tests for new endpoints.

## How to add shared enums and DTOs

1. Open `packages/shared/src` and add types or Zod schemas.
2. Export new symbols from `packages/shared/src/index.ts`.
3. Bump usages across `apps/api` and `apps/web` to import from `@actbyme/shared`.

## How to update Prisma schema and migrations

1. Edit `packages/database/prisma/schema.prisma` to add/modify models.
2. Generate and run migration locally: from repo root run `pnpm --filter @actbyme/database db:migrate`.
3. If you need to regenerate client: `pnpm --filter @actbyme/database db:generate`.
4. Commit migration files under `packages/database/prisma/migrations`.
5. Do not modify migration history on main without coordination.

## Security rules for videos and private data

- Never expose raw or unprotected S3/storage URLs in the public frontend.
- Use signed, time-limited URLs for playback when necessary.
- Store private video metadata and access permissions in the database; gate playback on the server.
- At-rest video objects must be stored with appropriate ACLs (private buckets by default).
- Redact or avoid storing sensitive personal data unless required; encrypt secrets and credentials.

## Rules about fake/demo actors

- Do not create fake actors presented as real users.
- Demo actors are allowed only if clearly labelled as “Demo profile” or “Sample profile”.
- Any seeded/demo data must be obvious and non-deceptive in the UI (visible badge or label).

## Important product rules (summarized)

- MVP is actor-first: focus on actor registration, public profile, video portfolio, access requests.
- Do not build client dashboards or payments unless explicitly requested.
- Do not allow final downloadable video delivery before approval in future marketplace flows.

## Agent workflow expectations

- Keep PRs small and focused; explain changes in PR descriptions.
- Run lint/typecheck locally and include automated tests where feasible.
- When in doubt about product decisions, default to the actor-first MVP and ask maintainers.

---

If you are an AI agent: follow these rules strictly and refer to this document before making changes that affect product behavior or seeded data.
