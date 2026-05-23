# Playwright E2E Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright E2E test infrastructure and two UI tests (movie detail + delete).

**Architecture:** Install `@playwright/test`, create config pointing at `localhost:3000` with the existing test Postgres DB. A seed script inserts a known movie. The `test:e2e` npm script resets the test DB, seeds it, starts Next.js, runs Playwright, and cleans up.

**Tech Stack:** Next.js 16, Playwright, Postgres, Prisma

---

### Task 1: Install Playwright and create config

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test && npx playwright install chromium
```

- [ ] **Step 2: Create playwright.config.ts**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    browserName: 'chromium',
  },
});
```

- [ ] **Step 3: Add test:e2e script to package.json**

Add to `scripts` in `package.json`:
```json
"test:e2e": "dotenv -e .env.test -- prisma migrate reset --force && dotenv -e .env.test -- prisma migrate deploy && dotenv -e .env.test -- tsx tests/seed.ts && dotenv -e .env.test -- next dev -p 3000 & SERVER_PID=$! && npx wait-on http://localhost:3000 && npx playwright test; kill $SERVER_PID 2>/dev/null"
```

Also add `wait-on` as a dev dependency:
```bash
npm install -D wait-on
```

- [ ] **Step 4: Commit**

```bash
git add package.json playwright.config.ts
git commit -m "chore: add Playwright E2E test infrastructure"
```

---

### Task 2: Create seed script

**Files:**
- Create: `tests/seed.ts`

- [ ] **Step 1: Create tests/seed.ts**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  await prisma.movie.create({
    data: {
      tmdb_id: 550,
      title: 'Fight Club',
      description: 'A ticking-Loss, bomb-insane insurance clerk...',
      release_date: 1999,
      vote_average: 8.4,
      genres: 'Drama, Thriller',
    },
  });
}

seed()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Verify seed script works**

```bash
dotenv -e .env.test -- prisma migrate reset --force && dotenv -e .env.test -- prisma migrate deploy && dotenv -e .env.test -- tsx tests/seed.ts
```

Expected: exits cleanly with no errors.

- [ ] **Step 3: Commit**

```bash
git add tests/seed.ts
git commit -m "feat: add E2E test seed script"
```

---

### Task 3: Write delete movie E2E test

**Files:**
- Create: `tests/delete-movie.spec.ts`

- [ ] **Step 1: Create tests/delete-movie.spec.ts**

```typescript
import { test, expect } from '@playwright/test';

test('delete a movie from the detail page', async ({ page }) => {
  // Start at movie listing — seeded movie should be visible
  await page.goto('/movies');
  await expect(page.getByText('Fight Club')).toBeVisible();

  // Click through to the movie detail page
  await page.getByText('Fight Club').click();
  await page.waitForURL(/\/movies\/\d+/);
  await expect(page.getByRole('heading', { name: 'Fight Club' })).toBeVisible();

  // Click delete and accept the confirmation dialog
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Movie' }).click();

  // After deletion, should redirect back to /movies
  await page.waitForURL('/movies');
  await expect(page.getByText('Fight Club')).not.toBeVisible();
});

test('cancel delete does not remove the movie', async ({ page }) => {
  await page.goto('/movies');
  await page.getByText('Fight Club').click();
  await page.waitForURL(/\/movies\/\d+/);

  // Dismiss the confirmation dialog
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Movie' }).click();

  // Should still be on the detail page — movie not deleted
  await expect(page.getByRole('heading', { name: 'Fight Club' })).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/delete-movie.spec.ts
git commit -m "feat: add delete movie E2E test"
```

---

### Task 4: Write movie detail page E2E test

**Files:**
- Create: `tests/movie-detail.spec.ts`

- [ ] **Step 1: Create tests/movie-detail.spec.ts**

```typescript
import { test, expect } from '@playwright/test';

test('movie detail page renders correctly for seeded movie', async ({ page }) => {
  // Navigate to movies listing and click the seeded movie
  await page.goto('/movies');
  await page.getByText('Fight Club').click();
  await page.waitForURL(/\/movies\/\d+/);

  // Title
  await expect(page.getByRole('heading', { name: 'Fight Club' })).toBeVisible();

  // Description
  await expect(page.getByText('A ticking-Loss, bomb-insane insurance clerk...')).toBeVisible();

  // Year
  await expect(page.getByText('1999')).toBeVisible();

  // Rating
  await expect(page.getByText('★ 8.4')).toBeVisible();

  // Genre badges
  await expect(page.getByText('Drama')).toBeVisible();
  await expect(page.getByText('Thriller')).toBeVisible();

  // Delete button
  await expect(page.getByRole('button', { name: 'Delete Movie' })).toBeVisible();

  // Back link
  await expect(page.getByRole('link', { name: '← Back to movies' })).toBeVisible();
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/movie-detail.spec.ts
git commit -m "feat: add movie detail page E2E test"
```

---

### Task 5: Run full E2E suite and verify

- [ ] **Step 1: Run the full test:e2e pipeline**

```bash
npm run test:e2e
```

Expected: All 3 tests pass (delete, cancel-delete, movie detail).

- [ ] **Step 2: Run lint to confirm no issues**

```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 3: Commit any final tweaks**

```bash
git add -A && git commit -m "chore: finalize E2E test setup"
```