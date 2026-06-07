# Structured Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all ad-hoc `console.log/error` calls with a unified Pino-based structured logging system, add automatic HTTP request logging for all API routes, and ensure the db migration Job and daily summary CronJob emit structured logs.

**Architecture:** Two shared utilities (`logger.ts` and `with-logging.ts`) plus a migration wrapper script. All API routes are wrapped with `withLogging`; all `console.*` calls are replaced with `logger.*`.

**Tech Stack:** Next.js 16, TypeScript, Pino, pino-pretty, Prisma, Jest, Helm, Kubernetes

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `pino` and `pino-pretty` dependencies |
| `src/lib/logger.ts` | Create | Shared Pino instance (pretty dev, JSONL prod) |
| `src/lib/with-logging.ts` | Create | HOF wrapping API routes with request logging |
| `src/lib/__tests__/with-logging.test.ts` | Create | Unit tests for `withLogging` |
| `scripts/migrate.ts` | Create | Wrapper for `prisma migrate deploy` with logging |
| `src/app/api/tmdb/search/route.ts` | Modify | Wrap with `withLogging`, replace `console.error` |
| `src/app/api/jellyfin/check/route.ts` | Modify | Wrap with `withLogging`, replace `console.error` |
| `src/app/api/requests/[id]/route.ts` | Modify | Wrap with `withLogging`, replace `console.error` |
| `src/app/api/cron/daily-summary/route.ts` | Modify | Wrap with `withLogging`, replace `console.error` |
| `src/app/api/health/live/route.ts` | Modify | Wrap with `withLogging` (excluded from logging) |
| `src/app/api/health/readiness/route.ts` | Modify | Wrap with `withLogging` (excluded from logging) |
| `src/lib/notifications.ts` | Modify | Replace `console.error` with `logger.error` |
| `src/app/page.tsx` | Modify | Replace `console.error` with `logger.error` |
| `src/components/RequestListItem.tsx` | Modify | Replace `console.error` with `logger.error` |
| `scripts/daily-summary.ts` | Modify | Replace `console.error` with `logger.error` |
| `tests/seed.ts` | Modify | Replace `console.error` with `logger.error` |
| `Dockerfile` | Modify | Add build step for `scripts/migrate.ts` |
| `helm/templates/job-db-migrate.yaml` | Modify | Change command to `node scripts/migrate.js` |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `pino` and `pino-pretty` to dependencies**

Add to the `dependencies` section of `package.json`:

```json
    "pino": "^9.6.0",
    "pino-pretty": "^13.0.0",
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add pino and pino-pretty for structured logging"
```

---

### Task 2: Create Shared Logger

**Files:**
- Create: `src/lib/logger.ts`
- Test: `src/lib/__tests__/logger.test.ts` (optional)

- [ ] **Step 1: Write `src/lib/logger.ts`**

```typescript
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/logger.ts
git commit -m "feat: add shared Pino logger with pretty dev and JSONL prod"
```

---

### Task 3: Create Request Logging Wrapper

**Files:**
- Create: `src/lib/with-logging.ts`
- Test: `src/lib/__tests__/with-logging.test.ts`

- [ ] **Step 1: Write `src/lib/with-logging.ts`**

```typescript
import { NextRequest } from 'next/server';
import { logger } from './logger';
import { randomUUID } from 'crypto';

const EXCLUDED_PATHS = ['/api/health/live', '/api/health/readiness'];

export function withLogging<T>(
  handler: (req: Request | NextRequest, context?: T) => Promise<Response>
): (req: Request | NextRequest, context?: T) => Promise<Response> {
  return async (req: Request | NextRequest, context?: T) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (EXCLUDED_PATHS.includes(pathname)) {
      return handler(req, context);
    }

    const requestId = randomUUID();
    const start = performance.now();

    logger.info({ method: req.method, path: pathname, requestId }, 'request_start');

    try {
      const response = await handler(req, context);
      const durationMs = Math.round(performance.now() - start);
      logger.info({ status: response.status, durationMs, requestId }, 'request_complete');
      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, durationMs, requestId }, 'request_error');
      throw error;
    }
  };
}
```

- [ ] **Step 2: Write the test file `src/lib/__tests__/with-logging.test.ts`**

```typescript
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('withLogging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs request_start and request_complete for successful requests', async () => {
    const handler = jest.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withLogging(handler);
    const req = new Request('http://localhost/api/test');

    const response = await wrapped(req);
    expect(response.status).toBe(200);
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenNthCalledWith(1, expect.objectContaining({ method: 'GET', path: '/api/test', requestId: expect.any(String) }), 'request_start');
    expect(logger.info).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 200, durationMs: expect.any(Number), requestId: expect.any(String) }), 'request_complete');
  });

  it('logs request_error and re-throws on failure', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    const wrapped = withLogging(handler);
    const req = new Request('http://localhost/api/test');

    await expect(wrapped(req)).rejects.toThrow('boom');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ error: 'boom', durationMs: expect.any(Number), requestId: expect.any(String) }), 'request_error');
  });

  it('skips logging for health probe paths', async () => {
    const handler = jest.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withLogging(handler);
    const req = new Request('http://localhost/api/health/live');

    await wrapped(req);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npm run test -- src/lib/__tests__/with-logging.test.ts`

Expected: 3 passing tests

- [ ] **Step 4: Commit**

```bash
git add src/lib/with-logging.ts src/lib/__tests__/with-logging.test.ts
git commit -m "feat: add withLogging wrapper for structured request logging"
```

---

### Task 4: Create Migration Script

**Files:**
- Create: `scripts/migrate.ts`

- [ ] **Step 1: Write `scripts/migrate.ts`**

```typescript
import { logger } from '../src/lib/logger';
import { execSync } from 'child_process';

const start = performance.now();
logger.info('migration_start');

try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  const durationMs = Math.round(performance.now() - start);
  logger.info({ durationMs }, 'migration_complete');
} catch (error) {
  const durationMs = Math.round(performance.now() - start);
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error({ error: errorMessage, durationMs }, 'migration_failed');
  process.exit(1);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate.ts
git commit -m "feat: add migration script with structured logging"
```

---

### Task 5: Update API Routes — Part 1 (Search & Jellyfin)

**Files:**
- Modify: `src/app/api/tmdb/search/route.ts`
- Modify: `src/app/api/jellyfin/check/route.ts`

- [ ] **Step 1: Update `src/app/api/tmdb/search/route.ts`**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { searchTMDBMovies } from '@/lib/tmdb';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchTMDBMovies(query);
    return NextResponse.json({ results });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'TMDB search failed');
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const GET_LOGGED = withLogging(GET);
```

Wait — Next.js App Router exports need to be named `GET`, not `GET_LOGGED`. We need to export the wrapped function as `GET`.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { searchTMDBMovies } from '@/lib/tmdb';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchTMDBMovies(query);
    return NextResponse.json({ results });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'TMDB search failed');
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler);
```

- [ ] **Step 2: Update `src/app/api/jellyfin/check/route.ts`**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkMovieOnJellyfin, checkMoviesOnJellyfin } from '@/lib/jellyfin';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

async function handler(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ids = searchParams.get('ids')?.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: 'No valid movie IDs provided' }, { status: 400 });
  }

  try {
    let result;
    if (ids.length === 1) {
      result = await checkMovieOnJellyfin(ids[0]);
    } else {
      result = await checkMoviesOnJellyfin(ids);
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Jellyfin check failed');
    return NextResponse.json(
      {
        error: 'Failed to check Jellyfin status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler);
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tmdb/search/route.ts src/app/api/jellyfin/check/route.ts
git commit -m "feat: add structured logging to search and jellyfin API routes"
```

---

### Task 6: Update API Routes — Part 2 (Requests & Cron)

**Files:**
- Modify: `src/app/api/requests/[id]/route.ts`
- Modify: `src/app/api/cron/daily-summary/route.ts`

- [ ] **Step 1: Update `src/app/api/requests/[id]/route.ts`**

Replace the entire file with:

```typescript
import { prisma } from '@/lib/prisma';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

async function handler(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requestId = parseInt(id, 10);

    if (isNaN(requestId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await prisma.request.delete({
      where: { id: requestId },
    });

    return new Response(
      JSON.stringify({ success: true, id: requestId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error deleting request');
    return new Response(
      JSON.stringify({ error: 'Failed to delete request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const DELETE = withLogging(handler);
```

- [ ] **Step 2: Update `src/app/api/cron/daily-summary/route.ts`**

Replace the entire file with:

```typescript
import { prisma } from '@/lib/prisma';
import { sendDailySummary } from '@/lib/notifications';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function handler() {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = (await headers()).get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const requests = await prisma.request.findMany({
      where: {
        status: {
          in: ['pending', 'downloading'],
        },
      },
      orderBy: {
        requested_at: 'desc',
      },
    });

    await sendDailySummary(requests);

    return NextResponse.json({ status: 'ok', count: requests.length });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Daily summary cron failed');
    return NextResponse.json({ status: 'error', message: 'Daily summary failed' }, { status: 500 });
  }
}

export const GET = withLogging(handler);
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/requests/\[id\]/route.ts src/app/api/cron/daily-summary/route.ts
git commit -m "feat: add structured logging to requests and cron API routes"
```

---

### Task 7: Update API Routes — Part 3 (Health)

**Files:**
- Modify: `src/app/api/health/live/route.ts`
- Modify: `src/app/api/health/readiness/route.ts`

- [ ] **Step 1: Update `src/app/api/health/live/route.ts`**

Replace the entire file with:

```typescript
import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/with-logging';

export const dynamic = 'force-static';

async function handler() {
  const response = NextResponse.json({ status: 'ok' });
  response.headers.set('Cache-Control', 'no-cache, private, no-store');
  return response;
}

export const GET = withLogging(handler);
```

- [ ] **Step 2: Update `src/app/api/health/readiness/route.ts`**

Replace the entire file with:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkJellyfinConnectivity } from '@/lib/jellyfin';
import { withLogging } from '@/lib/with-logging';

export const dynamic = 'force-static';

async function handler() {
  try {
    const dbConnected = await prisma.$queryRaw`SELECT 1`;
    const dbStatus = dbConnected ? 'ok' : 'error';

    const jellyfinResult = await checkJellyfinConnectivity();
    const jellyfinStatus = !jellyfinResult.configured ? 'not_configured' :
                           jellyfinResult.reachable ? 'ok' : 'error';

    const overallStatus = dbStatus === 'ok' && jellyfinStatus !== 'error' ? 'ok' : 'error';

    return NextResponse.json({
      status: overallStatus,
      database: dbStatus,
      jellyfin: jellyfinStatus
    }, {
      status: overallStatus === 'ok' ? 200 : 503
    });
  } catch {
    return NextResponse.json(
      { status: 'error', database: 'error', jellyfin: 'error' },
      { status: 503 }
    );
  }
}

export const GET = withLogging(handler);
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/health/live/route.ts src/app/api/health/readiness/route.ts
git commit -m "feat: add structured logging to health API routes"
```

---

### Task 8: Replace `console.*` in Library and Component Files

**Files:**
- Modify: `src/lib/notifications.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/components/RequestListItem.tsx`
- Modify: `scripts/daily-summary.ts`
- Modify: `tests/seed.ts`

- [ ] **Step 1: Update `src/lib/notifications.ts`**

Add import at the top:
```typescript
import { logger } from './logger';
```

Replace `console.error` calls:
```typescript
// In sendRequestNotification catch block:
logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to send request notification');

// In sendDailySummary catch block:
logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to send daily summary');
```

- [ ] **Step 2: Update `src/app/page.tsx`**

Add import:
```typescript
import { logger } from '@/lib/logger';
```

Replace `console.error` calls with `logger.error({ error: err instanceof Error ? err.message : String(err) }, ...)`.

- [ ] **Step 3: Update `src/components/RequestListItem.tsx`**

Add import:
```typescript
import { logger } from '@/lib/logger';
```

Replace all `console.error` calls with `logger.error({ error: error instanceof Error ? error.message : String(error) }, ...)`.

- [ ] **Step 4: Update `scripts/daily-summary.ts`**

Add import:
```typescript
import { logger } from '../src/lib/logger';
```

Replace `console.error` with `logger.error`.

- [ ] **Step 5: Update `tests/seed.ts`**

Add import:
```typescript
import { logger } from '../src/lib/logger';
```

Replace `console.error` with `logger.error`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications.ts src/app/page.tsx src/components/RequestListItem.tsx scripts/daily-summary.ts tests/seed.ts
git commit -m "feat: replace console.error with structured logger calls"
```

---

### Task 9: Update Dockerfile for Migration Script

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Add build step in `Dockerfile` builder stage**

After the `RUN npm run build` line in the `builder` stage, add:

```dockerfile
# Compile the migration script for runtime
RUN npx tsc scripts/migrate.ts --outDir scripts --esModuleInterop --module commonjs --target es2020 --resolveJsonModule
```

- [ ] **Step 2: Copy compiled migration script in runner stage**

After the `COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated` line, add:

```dockerfile
# Copy compiled migration script
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.js ./scripts/migrate.js
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat: compile migration script in Docker build"
```

---

### Task 10: Update Helm Job Command

**Files:**
- Modify: `helm/templates/job-db-migrate.yaml`

- [ ] **Step 1: Update command in `helm/templates/job-db-migrate.yaml`**

Change:
```yaml
command: ["npm", "run", "db:migrate"]
```

To:
```yaml
command: ["node", "scripts/migrate.js"]
```

- [ ] **Step 2: Commit**

```bash
git add helm/templates/job-db-migrate.yaml
git commit -m "feat(helm): use compiled migration script in db-migrate job"
```

---

### Task 11: Run Full Validation

- [ ] **Step 1: Run all validation checks**

Run: `npm run check`

This must pass with 0 lint warnings, 0 test failures, and a successful build.

- [ ] **Step 2: Commit any auto-generated changes**

If `npm run check` regenerated the Prisma client or changed `tsconfig.tsbuildinfo`, commit those:

```bash
git add -A
git commit -m "chore: regenerate prisma client and update build info" || true
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|------------------|------|
| Create shared Pino logger | Task 2 |
| Create `withLogging` wrapper | Task 3 |
| Unit tests for `withLogging` | Task 3 |
| Health probe exclusion | Task 3 (test) + Task 7 (routes) |
| Migration script with logging | Task 4 |
| Update all API routes with `withLogging` | Tasks 5, 6, 7 |
| Replace all `console.*` with `logger.*` | Tasks 5, 6, 7, 8 |
| Cron job observability | Task 6 (wrapped route) |
| Dockerfile compile step | Task 9 |
| Helm job command change | Task 10 |
| Full validation | Task 11 |

## Placeholder Scan

- No "TBD", "TODO", or "implement later" found.
- All code blocks contain complete, runnable code.
- All file paths are exact and match the project structure.

## Type Consistency

- `withLogging` accepts `Request | NextRequest` and returns `Promise<Response>` consistently.
- `logger.info/error` signatures match Pino's API.
- All error objects are normalized to strings using `error instanceof Error ? error.message : String(error)`.
