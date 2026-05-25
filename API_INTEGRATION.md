# Frontend-Backend Integration Summary

## Setup Changes

### 1. Environment Variables

Added `NEXT_PUBLIC_API_URL` to `.env`:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
```

### 2. Dependencies

Installed TanStack Query for data fetching in `apps/web/package.json`:

```bash
pnpm install
```

## API Infrastructure

### Typed API Client (`apps/web/lib/api/`)

**client.ts** - HTTP client with proper error handling:

- `apiFetch()` - Base fetch wrapper with JSON headers
- `actorsApi.listActors()` - GET /actors with filters
- `actorsApi.getActor(slug)` - GET /actors/:slug
- `actorsApi.requestAgencyAccess()` - POST /agency-access

**hooks.ts** - TanStack Query hooks:

- `useActorsList(query)` - Fetch actors with caching
- `useActorDetail(slug)` - Fetch single actor profile
- Automatic cache invalidation and retry logic

**types.ts** - TypeScript interfaces for all API responses

## Backend Endpoints

### Updated NestJS Controllers

**GET /api/actors** - List actors with filters

```
Query parameters:
- search: string (searches name, bio)
- language: string (filter by language code)
- accent: string (filter by accent name)
- skill: string (filter by skill category)
- motionSkill: string (filter by motion category)
- sort: "featured" | "score" | "newest"
- limit: number (1-100, default: 20)
- offset: number (default: 0)

Response: { data: ActorListItem[], total: number, limit: number, offset: number }
```

**GET /api/actors/:slug** - Get actor profile by slug

```
Returns full actor detail with videos
Only APPROVED or demo profiles visible
```

### Database & Seeding

Demo actors are seeded with:

- `isDemo: true` flag (visible in catalog)
- "Demo profile" badge in UI
- `status: ActorProfileStatus.APPROVED` (publicly visible)
- Full profile data: skills, languages, accents, videos

Run seed with:

```bash
cd packages/database
pnpm db:seed
```

## Frontend Pages

### /actors - Discovery Catalog

- Fetches from `GET /api/actors`
- Real-time search/filter/sort
- Loading and error states
- Responsive grid layout
- Demo profiles clearly labeled

### /actors/[slug] - Actor Profile

- Fetches from `GET /api/actors/:slug`
- Error handling for non-existent or non-approved profiles
- Full actor details with videos
- Share and agency access CTAs

## For Development

### Mock Authentication

Uses mock header for now:

```typescript
"X-User-Id": process.env.NEXT_PUBLIC_MOCK_USER_ID || "dev-user"
```

### Testing the Integration

1. Start database (PostgreSQL)
2. Run migrations: `pnpm --filter @actbyme/database db:migrate`
3. Seed data: `pnpm --filter @actbyme/database db:seed`
4. Start API: `pnpm --filter @actbyme/api dev`
5. Start frontend: `pnpm --filter @actbyme/web dev`
6. Visit http://localhost:3000/actors

## Key Features

✅ **Type Safety** - End-to-end TypeScript types from API to UI
✅ **Performance** - TanStack Query caching, configurable stale times
✅ **Error Handling** - Typed errors, user-friendly messages
✅ **Demo Profiles** - Always marked with visible badge
✅ **Privacy** - Only APPROVED actors visible (+ demos with badge)
✅ **Filtering** - Language, accent, skill, motion categories
✅ **Search** - Real-time search across name and bio
✅ **Loading States** - Spinner during data fetch
✅ **Responsive** - Mobile-first design

## API Response Format

```typescript
// List Response
{
  data: [
    {
      id: string,
      slug: string,
      stageName: string,
      profileImageUrl: string | null,
      bio: string | null,
      city: string | null,
      country: string | null,
      actAiScore: number | null,
      isDemo: boolean,
      status: "APPROVED" | "DRAFT" | "PENDING_REVIEW" | "REJECTED" | "SUSPENDED",
      skills: { id, category, label, yearsExperience }[],
      languages: { id, language, proficiency }[],
      accents: { id, name }[]
    }
  ],
  total: number,
  limit: number,
  offset: number
}

// Detail Response (extends List Item)
{
  ...listItem,
  heroVideoUrl: string | null,
  videos: [
    {
      id, title, description, type, videoUrl,
      thumbnailUrl, durationSeconds, visibility, createdAt
    }
  ]
}
```

## Next Steps

1. **Authentication** - Replace mock headers with real auth tokens
2. **Agency Access Requests** - POST endpoint and form
3. **Actor Onboarding** - Connect form submissions to API
4. **Video Upload** - Storage integration
5. **Search Optimization** - Full-text search on backend
