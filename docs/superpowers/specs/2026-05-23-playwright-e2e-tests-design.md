# Playwright E2E Tests — Design Spec

**Date:** 2026-05-23
**Scope:** Add Playwright E2E test infrastructure and two UI tests covering movie import (via seeding) and delete flows.

---

## 1. Goals

1. Install and configure `@playwright/test` for E2E testing.
2. Add a Playwright config targeting the existing test PostgreSQL database.
3. Create a seed script that inserts a known movie for tests.
4. Write a delete test: visit movie detail → click delete → confirm → verify redirect + absence.
5. Write an import-equivalent test: verify the seeded movie detail page renders correctly (title, metadata, poster fallback) — validating the same DB → UI path that import produces.
6. Add `test:e2e` npm script: reset test DB → apply migrations → seed → start Next.js → run Playwright → cleanup.

---

## 2. Infrastructure

### 2.1 Dependencies

Add `@playwright/test` as a dev dependency.

### 2.2 Playwright Config (`playwright.config.ts`)

```
- testDir: tests/
- fullyParallel: false (sequential for DB isolation)
- retries: 0 (stateless, clean DB per run)
- use: baseURL http://localhost:3000, headless Chromium
- webServer: not used — we control lifecycle in test:e2e script
```

### 2.3 E2E Script (`test:e2e`)

```bash
# 1. Reset + migrate test DB (clean slate)
dotenv -e .env.test -- prisma migrate reset --force
dotenv -e .env.test -- prisma migrate deploy

# 2. Seed test data
dotenv -e .env.test -- tsx tests/seed.ts

# 3. Start Next.js on test DB
dotenv -e .env.test -- next dev -p 3000 &
SERVER_PID=$!

# 4. Wait for server readiness, then run Playwright
wait-on http://localhost:3000
npx playwright test

# 5. Cleanup
kill $SERVER_PID
```

### 2.4 Test Database

Uses the existing `moviedb_test` Postgres database defined in `.env.test`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/moviedb_test"
```

No changes needed to `.env.test` or infrastructure.

---

## 3. Seed Script (`tests/seed.ts`)

Inserts a single known movie using the Prisma client:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  await prisma.movie.create({
    data: {
      tmdb_id: 550,
      title: 'Fight Club',
      description: 'A ticking-Loss, bomb-insane...',
      release_date: 1999,
      vote_average: 8.4,
      genres: 'Drama, Thriller',
    },
  });
}

seed().then(() => prisma.$disconnect());
```

This matches the existing unit test data so the seed is self-documenting.

---

## 4. Test: Delete Movie (`tests/delete-movie.spec.ts`)

1. Navigate to `/movies`.
2. Verify "Fight Club" is visible in the grid (confirm seeded movie exists).
3. Click the "Fight Club" link to navigate to `/movies/550` (actual ID may differ — use first movie link in grid).
4. Verify the detail page shows the movie title "Fight Club".
5. Click "Delete Movie" button.
6. Accept the browser `confirm()` dialog.
7. Wait for redirect to `/movies`.
8. Verify "Fight Club" no longer appears in the movie grid.
9. Verify the page shows an empty state (no movies).

**Edge cases handled:**
- Movie ID is dynamic (autoincrement) — test navigates by clicking the link, not by hardcoded URL.
- Confirmation dialog dismissed → verifies movie still exists (cancellation path).

---

## 5. Test: Movie Detail Page (Import Outcome) (`tests/movie-detail.spec.ts`)

1. Navigate to `/movies`.
2. Click the "Fight Club" movie link.
3. Verify the movie title "Fight Club" displays.
4. Verify description renders.
5. Verify year "1999" displays.
6. Verify genre badges ("Drama", "Thriller") render.
7. Verify rating (★ 8.4) displays.
8. Verify "Delete Movie" button exists.
9. Verify "Back to movies" link exists.

This validates the full DB → UI round trip that the import flow produces, without needing a real TMDB API call.

---

## 6. Files

| File | Action |
|------|--------|
| `package.json` | Modify — add `@playwright/test` dep, add `test:e2e` script |
| `playwright.config.ts` | **Create** — Playwright configuration |
| `tests/seed.ts` | **Create** — DB seed for E2E tests |
| `tests/delete-movie.spec.ts` | **Create** — delete flow test |
| `tests/movie-detail.spec.ts` | **Create** — movie detail page test |

---

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Test DB not running | `prisma migrate reset` fails; script exits with clear error |
| Next.js fails to start | `wait-on` times out; script exits |
| Movie not found on detail page | Test assertion fails with clear message |
| Seed fails (duplicate) | `prisma migrate reset --force` ensures clean slate each run |

---

## 8. CI Integration

The existing CI workflow is stale (Ruby/Rails). No changes to `.github/workflows/ci.yml` in this spec. Future work: update CI to run `test:e2e` with a Postgres service container.