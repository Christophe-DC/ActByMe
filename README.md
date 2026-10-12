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

## Director Studio 3D

Director Studio is optional for each performance project. Generate the shooting plan, then
activate the studio to describe staging, gestures, gaze and camera movements. The AI returns
validated scene data rendered locally with Three.js and React Three Fiber. You can scrub the
timeline, change camera views, edit trajectories and cues, undo/redo, save, and revise with AI.
Approve the shooting plan and select the actor's character before validating the preview.
An enabled studio must have a current validated revision before an actor request can be sent.
After sending, the assigned actor sees that immutable revision alongside the existing recording
guide. Preview camera cuts do not change the continuous-take recording requirements.

The public demonstration at `/director-studio/demo` contains three fictional characters and
four camera angles. It uses the same player as real projects and creates no actor accounts.
WebGL 2 is required for 3D; timed text instructions remain available when WebGL is unavailable.

Run `pnpm db:generate` and apply the new migration with `pnpm db:deploy` to the intended database
before starting the updated API. Production migrations and deployment are separate operations.
Gemini uses the existing `GEMINI_API_KEY`, `GEMINI_DIRECTOR_MODEL` and fallback settings; no
additional AI account, storage bucket, model assets or video-rendering service is required.

NestJS polls persisted studio jobs every two seconds. Workers atomically claim jobs, retain the
last valid preview on failure, and fail interrupted jobs after twenty minutes so owners can retry.
Multiple API instances can run the worker safely. Jobs and revisions stay private to the project
owner; only the revision pinned to the current actor assignment is returned to the actor.
Studio reads and mutations live under `/performance-projects/:id/director-studio`:
`GET /`, `POST /activation`, `POST /generate`, `PUT /revision`, and `POST /approve`.
Mutations carry the last read `version`; conflicting saves return HTTP 409. `GET /` includes the
latest task status for polling. Revision validation is server-side, including on edited scenes.

### Studio verification

- `pnpm --filter @actbyme/shared test` tests scene validation and deterministic animation sampling.
- `pnpm --filter @actbyme/api test` includes existing workflow tests and studio unit tests.
- Set `STUDIO_TEST_DATABASE_URL` to a dedicated **local** PostgreSQL database whose name starts
  with `studio_test`, migrate it using `DATABASE_URL="$STUDIO_TEST_DATABASE_URL" pnpm db:deploy`,
  then run the API tests to include persistence, concurrent saves, job recovery and revision locking.
- After `pnpm build`, run `pnpm --filter @actbyme/web exec playwright install chromium`, then
  `pnpm --filter @actbyme/web test:e2e` with `STUDIO_TEST_DATABASE_URL` set. The harness starts
  isolated API/frontend servers on ports 4401/3401 and cleans up its fixtures. It exercises actual
  HTTP routes, database persistence, the 3D editor, assignment, actor acceptance/upload/submission,
  mobile layout and WebGL fallback. AI, storage, QA and authentication sessions are controlled
  test fixtures; it never sends emails or contacts production services.
- Optional real-provider check: with the same isolated database and built API, run
  `node apps/api/test/studio-live.mjs`. It reads the existing local Gemini configuration without
  logging credentials, generates a real scene and removes its test project afterwards.
