# ActByMe

ActByMe is an actor-first marketplace for AI-powered video production. The first MVP focuses on actor acquisition: free actor registration, premium public actor profiles, skill video uploads, social sharing, and agency/client access requests.

## Monorepo

- `apps/web`: Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI primitives, Framer Motion
- `apps/api`: NestJS API, TypeScript, Prisma integration boundary, storage abstraction
- `packages/database`: Prisma schema, migrations, seed, generated client boundary
- `packages/shared`: shared enums, DTOs, Zod schemas, constants
- `packages/ui`: reusable UI components

## Local Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create local env:

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL and set `DATABASE_URL`.

4. Generate Prisma Client and run migrations:

   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. Run all apps:

   ```bash
   pnpm dev
   ```

The web app runs on `http://localhost:3000`. The API defaults to `http://localhost:4000`.

## Useful Commands

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm db:seed
```

## Next Task

Implement the actor registration and public profile flow:

- actor registration form with shared Zod validation
- profile draft persistence in the API
- public profile route at `/actors/[slug]`
- first video upload contract using the storage abstraction

## Agent guidelines

See [AGENTS.md](AGENTS.md) for AI coding agent rules, contribution guidance, and product constraints.
