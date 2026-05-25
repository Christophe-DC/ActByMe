# API Integration - Getting Started Guide

## Prerequisites

### Node Version

⚠️ **Current Issue**: Your Node version (v16.20.0) is too old for pnpm 11.

- Minimum required: Node.js v22.13
- Consider updating Node.js using nvm or similar tools

### Installation Issue

If you see: `This version of pnpm requires at least Node.js v22.13`

```bash
# Option 1: Use nvm to update Node
nvm install 22
nvm use 22

# Option 2: Or install dependencies manually first, then continue
npm install --save @tanstack/react-query@^5.48.0 --workspace-root
```

## Quick Start

Once Node version is updated:

```bash
# 1. Install dependencies
cd /Users/christophe/Documents/web_projects/actbyme
pnpm install

# 2. Ensure PostgreSQL is running
# Mac (with Homebrew):
brew services start postgresql@latest

# 3. Create database (if not exists)
createdb actbyme

# 4. Run migrations
pnpm --filter @actbyme/database db:migrate

# 5. Seed demo data
pnpm --filter @actbyme/database db:seed

# 6. Start the API (in one terminal)
pnpm --filter @actbyme/api dev

# 7. Start the frontend (in another terminal)
pnpm --filter @actbyme/web dev

# 8. Open browser
open http://localhost:3000/actors
```

## What Was Implemented

### Environment Configuration

- ✅ Added `NEXT_PUBLIC_API_URL=http://localhost:4000/api` to `.env`

### API Client Layer (`apps/web/lib/api/`)

- ✅ **client.ts** - Typed HTTP client with error handling
- ✅ **hooks.ts** - TanStack Query hooks for data fetching
- ✅ **types.ts** - TypeScript interfaces for all responses
- ✅ **index.ts** - Public exports

### Frontend Pages

- ✅ **/actors** - Catalog with search/filters/sort
  - Fetches from `GET /api/actors`
  - Real-time filtering and search
  - Loading and error states
  - Demo profiles labeled

- ✅ **/actors/[slug]** - Individual profile
  - Fetches from `GET /api/actors/:slug`
  - Full actor details with videos
  - Error handling for missing profiles

### Backend Endpoints

- ✅ **GET /api/actors** - List with optional filters
  - Query params: search, language, accent, skill, motionSkill, sort, limit, offset
  - Returns paginated list of APPROVED actors

- ✅ **GET /api/actors/:slug** - Fetch actor by slug
  - Full profile with videos
  - Restricted to APPROVED or demo profiles only

### Shared Types & DTOs

- ✅ Added `ListActorsQueryDto` in `apps/api/src/actors/dto/`
- ✅ Added API response schemas in `packages/shared/src/schemas.ts`
- ✅ All types exported from `@actbyme/shared`

### React Query Setup

- ✅ **QueryClientProvider** in `apps/web/lib/providers.tsx`
- ✅ Integrated into root layout
- ✅ Cache config: 5min stale, 10min garbage collection

### Database

- ✅ Seed data with demo actors (4 profiles)
- ✅ All marked as `isDemo: true` and `APPROVED`
- ✅ "Demo profile" badge displays automatically

## File Structure

```
apps/
  web/
    lib/
      api/               ← NEW
        client.ts        ← HTTP client
        hooks.ts         ← React Query hooks
        types.ts         ← TypeScript interfaces
        index.ts         ← Exports
      providers.tsx      ← QueryClientProvider component
    components/
      actor-profile-experience.tsx  (updated to accept API data)
    app/
      actors/
        page.tsx         (updated to use API)
        [slug]/
          page.tsx       (updated to use API)
      layout.tsx         (added QueryClientProvider)
  api/
    src/
      actors/
        dto/
          list-actors.dto.ts  ← NEW (query parameters)
        actors.service.ts     (added listPublicActorsWithFilters)
        actors.controller.ts  (updated to use filters)
packages/
  shared/
    src/
      schemas.ts         (added API response DTOs)
```

## Demo Profiles in Database

The seed creates 4 demo actors:

1. **Maya Laurent** - Paris, France | Dance + Drama
2. **Jordan Kaito** - Los Angeles, USA | Martial Arts + Stunts
3. **Amina Okafor** - London, UK | Drama + Comedy
4. **Diego Morales** - Mexico City, Mexico | Comedy + Sports

All have:

- `isDemo: true` flag
- `status: APPROVED` (public visibility)
- Full skill/language/accent data
- Multiple videos
- "Demo profile" badge in UI

## Testing the Integration

### Manual Test Flow

1. Go to http://localhost:3000/actors
2. See list of 4 demo profiles (each has "Demo profile" badge)
3. Verify filtering works (search, language, skill dropdowns)
4. Click "View profile" on any actor
5. Verify full profile loads with videos

### Test Filtering

```
Search: "maya" → Shows Maya Laurent
Language: "French" → Shows Maya Laurent
Skill: "ACTING" → Shows multiple actors
Sort: "Featured" → Non-demo profiles first
```

## Error Handling

### If you see "Error loading actors"

- Check if API is running: `pnpm --filter @actbyme/api dev`
- Check if database is running: `brew services list`
- Check NEXT_PUBLIC_API_URL is set correctly in .env
- Check browser console for detailed error

### If you see "Actor not found" on profile page

- Verify slug is correct in URL
- Verify database seed ran: `pnpm --filter @actbyme/database db:seed`
- Check API logs for database errors

### If you see TypeScript errors

- Run `pnpm install` first
- Ensure Node.js >= v22.13

## Next Implementation Steps

After this integration is stable:

1. **Actor Onboarding** - Connect forms to POST endpoints
2. **Agency Access Requests** - POST /agency-access endpoint
3. **Video Upload** - Storage integration
4. **Authentication** - Replace mock headers with real auth
5. **Search Optimization** - Full-text search on backend
6. **Performance** - Add pagination, optimize queries
