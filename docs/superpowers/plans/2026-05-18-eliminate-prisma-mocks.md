# Eliminate Prisma Mocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove prisma mocks from movie.test.ts, replacing them with real database access against a test Postgres instance.

**Architecture:** Tests will use a real PrismaClient connected to the `moviedb_test` database. Table truncation between tests provides isolation. A jest setup file loads `.env.test` so the prisma module picks up the test DATABASE_URL automatically.

**Tech Stack:** Jest, Prisma, PostgreSQL, dotenv

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/test/setup.ts` | New — loads `.env.test` via dotenv before any test module runs |
| `jest.config.ts` | Modify — add `setupFiles` entry pointing to `src/test/setup.ts` |
| `package.json` | Modify — add `test:db` script that migrates then runs jest |
| `src/app/actions/movie.test.ts` | Modify — remove prisma mock, add real DB cleanup and assertions |

---

### Task 1: Add Jest setup file to load .env.test

**Files:**
- Create: `src/test/setup.ts`
- Modify: `jest.config.ts:3` (add setupFiles)
- Modify: `package.json:13` (add test:db script)

- [ ] **Step 1: Create the setup file**

```typescript
import { config } from 'dotenv';

config({ path: '.env.test' });
```

- [ ] **Step 2: Add setupFiles to jest.config.ts**

Add `setupFiles` to the config object, before `clearMocks`:

```typescript
const config: Config = {
  setupFiles: ["<rootDir>/src/test/setup.ts"],
  clearMocks: true,
```

- [ ] **Step 3: Add test:db script to package.json**

Add after the `"test": "jest"` line in the scripts section:

```json
"test:db": "dotenv -e .env.test -- prisma migrate deploy && jest",
```

- [ ] **Step 4: Verify jest still loads without errors**

Run: `npx jest --listTests 2>&1 | head -5`

Expected: Lists test files without errors about missing setup file.

- [ ] **Step 5: Commit**

```bash
git add src/test/setup.ts jest.config.ts package.json
git commit -m "feat: add jest setup file to load .env.test for real DB access"
```

---

### Task 2: Rewrite movie.test.ts to use real database

**Files:**
- Modify: `src/app/actions/movie.test.ts`

- [ ] **Step 1: Rewrite the test file — remove prisma mock, add real DB cleanup**

Replace the entire file content with:

```typescript
import { createMovie } from './movie';
import { prisma } from '../../lib/prisma';
import * as kafka from '../../lib/kafka';

jest.mock('../../lib/kafka', () => ({
  publishAudit: jest.fn()
}));

describe('Movie Actions', () => {
  beforeEach(async () => {
    await prisma.movie.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a movie and publishes audit event', async () => {
    const result = await createMovie({
      tmdb_id: 550,
      title: 'Fight Club',
      release_date: 1999
    });

    expect(result.tmdb_id).toBe(550);
    expect(result.title).toBe('Fight Club');

    const persisted = await prisma.movie.findUnique({ where: { tmdb_id: 550 } });
    expect(persisted).not.toBeNull();
    expect(persisted!.title).toBe('Fight Club');

    expect(kafka.publishAudit as jest.Mock).toHaveBeenCalledWith(
      'created',
      result.id,
      null,
      expect.objectContaining({ title: 'Fight Club' })
    );
  });

  it('rejects duplicate tmdb_id and does NOT publish audit event', async () => {
    await prisma.movie.create({
      data: { tmdb_id: 999, title: 'Original Movie' }
    });

    await expect(
      createMovie({ tmdb_id: 999, title: 'Duplicate Movie' })
    ).rejects.toThrow('Movie with TMDB ID 999 already exists');

    expect(kafka.publishAudit as jest.Mock).not.toHaveBeenCalled();
  });
});
```

Key changes:
- Removed `jest.mock('../../lib/prisma', ...)` and all `jest.mocked()` calls
- `beforeEach` now calls `prisma.movie.deleteMany()` to truncate the table
- `afterAll` disconnects prisma to allow jest to exit cleanly
- Test 1: calls real `createMovie()`, verifies return value, verifies row persisted in DB via real `findUnique`, verifies `publishAudit` called
- Test 2: seeds a movie directly via prisma, then calls `createMovie()` with the same `tmdb_id`, expects the "already exists" error from `movie.ts:26`, verifies `publishAudit` not called

- [ ] **Step 2: Verify the test file compiles**

Run: `npx tsc --noEmit --project tsconfig.test.json 2>&1 | head -20`

Expected: No type errors related to the test file.

- [ ] **Step 3: Run tests against real DB**

Prerequisite: test DB must have migrations applied. Run:

```bash
npm run db:migrate:test
```

Then run:

```bash
npx jest src/app/actions/movie.test.ts --verbose
```

Expected: Both tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/movie.test.ts
git commit -m "feat: replace prisma mocks with real DB access in movie tests"
```

---

### Task 3: Run full test suite and lint/typecheck

- [ ] **Step 1: Run full test suite**

Run: `npx jest --verbose`

Expected: All tests pass (movie.test.ts + kafka.test.ts).

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: No errors.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: No errors.
