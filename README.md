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
last valid preview on failure, and fail interrupted jobs after four minutes so owners can retry.
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
  logging credentials, generates a real scene, checks an exact partial edit and synchronized actor guide,
  then removes its test project afterwards.

### Visual workspace

Open `/studio` to create a scene directly from a script or start from one of three labelled
fictional templates. A recording plan is only needed when continuing into the existing actor
request workflow. Existing performance projects use the same visual editor.

Select a person, object, camera view or dialogue moment, then describe the change to the assistant.
The room view can mark a destination as context without moving the scene. Scene changes happen
only through the assistant; direct edits are limited to dialogue text. The API enforces that rule.
Camera cards and the timeline select context rather than mutating animation data. Examples and
a mobile shortcut help users get from a selection to a request without 3D parameters.
Dialogue saves are serialized and version-checked. Pending text is kept in this tab's session
storage, scoped to the authorized owner and project, for up to 24 hours. On reload, a matching
version recovers automatically; conflicts offer recovery of matching dialogue, text export or
explicit discard. Browser storage can be disabled; server saving still works, but tab recovery
then isn't available. The assistant request also survives reload in the same tab.
Undo/redo handles recent text edits; persisted history restores an older version as a new draft.

AI revisions produce patches for the selected person, camera, object, dialogue or whole scene.
The server rejects changes outside the selection, merges only provided fields, and validates the merged scene. Unchanged
items are preserved; the previous usable scene remains available during processing or failure.
Changing a selected camera's timing adjusts only its adjoining cut boundaries to keep continuous
coverage; deleting it extends the neighbouring camera view.

Sharing is explicit: an owner creates a read-only viewing link for an immutable saved version.
Links expire after 30 days and can be revoked. Only a SHA-256 hash of the random access token
is stored. The public viewer returns scene data, role and any explicitly enabled feedback, never the source
script, private assistant requests, recording-plan internals or project ownership details, and uses no-store/noindex headers. Editing and
history remain authenticated. The actor viewer focuses on their role with plain-language steps.

The migration `20261013120000_studio_visual_editor` adds draft directions, revision labels and
revocable share records; it preserves existing saved directions. Render's existing build command
applies migrations before starting the updated API. Release the frontend after the API is live.

### Reliability audit and revised recording flow

The audit identified independent actor-guide generation after scene edits, idle poses sliding
between positions, static gaze targets while partners moved, tracking presets that did not
follow their subject, repeated React updates during playback, and text lost on a failed save
followed by reload. These paths are covered by shared, PostgreSQL and browser regression tests.

“Prepare actor guide” previews the selected role's exact dialogue, movements, gaze and timings.
Validation atomically synchronizes the existing single-scene Shooting Plan, Actor Guide and QA
requirements, preserving lighting, format, orientation and background while adapting framing
and audio to the performance. It stores the recording plan on the immutable approved revision.
Assignments pin that revision; actors and QA use its saved plan. Already-sent older requests keep
their original guide. Camera cuts remain post-production preview directions, never recording cuts.
Restoring or editing a scene makes a draft that must be prepared again before sending.

Movement animation follows travelled distance, supports holds and easing, and blends gestures
and sitting poses. Gaze may track another character. Cameras support easing, following a moving
subject, dynamic focus and zoom. Static viewing uses [R3F demand rendering](https://r3f.docs.pmnd.rs/advanced/scaling-performance);
playback runs outside React, with throttled UI updates, visibility suspension and lower mobile GPU
cost. WebGL loss keeps all timed text available.

Studio generation uses a four-minute total deadline, bounded provider attempts with stable-model
fallbacks, one structured-output repair and an authenticated cancellation endpoint. Cancellation
revokes the worker token before stopping the local request; late responses cannot replace a scene.
Other Gemini workflows retain their existing retry settings. Quota and transport failures remain
visible; no demonstration replaces a failed scene.

Export provides a printable/PDF storyboard through the browser print dialog, an offline HTML
storyboard and a JSON scene file. These are preview/planning exports, not private performance-video
delivery. Text is escaped in HTML exports. Sharing can optionally allow authenticated feedback,
attached to a snapshot, selection and time. Feedback is bounded and rate-limited, contains no
account email/ID, and changes no scene or actor instruction until the owner asks the assistant.
Owners can resolve notes or revoke the viewing link. This is review collaboration, not simultaneous
scene editing; concurrent scene changes continue to use optimistic version checks.

Migration `20261013140000_studio_feedback` adds immutable recording-plan snapshots and optional
feedback. Apply it before the updated API, then release the frontend. No production fixtures or
fake actor accounts are created. Browser tests use simulated AI/auth/storage/QA; the optional
real-Gemini smoke test reports its own outcome separately.
