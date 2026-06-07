# Structured Logging Design

## Overview

Replace ad-hoc `console.log/error` calls with a unified Pino-based structured logging system. Add automatic HTTP request logging for all API routes. Ensure the db migration Job and the daily summary CronJob emit structured logs when they run.

## Context

- Project is a Next.js 16 App Router app with a PostgreSQL backend.
- Already deployed with a Helm chart on Kubernetes.
- Loki + Grafana Alloy are already deployed for log aggregation (pod logs are scraped from `/var/log/containers` and pushed to Loki).
- Existing code uses scattered `console.log/error` calls. No systematic request logging.
- The db migration is a Helm `pre-install,pre-upgrade` Job running `npm run db:migrate`.
- The daily summary is a CronJob that curls the `/api/cron/daily-summary` endpoint.

## Goals

1. Every web workload (API route) logs structured, queryable metadata: method, path, status, duration, request_id.
2. All existing `console.*` calls are replaced with structured logger calls.
3. The db migration job logs when it starts, completes, and fails.
4. The cron job's execution is observable via structured logs (via the API route it already hits).
5. Health probe routes (`/api/health/live`, `/api/health/readiness`) are excluded from request logging to reduce noise.

## Architecture

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Shared Logger | `src/lib/logger.ts` | Single Pino instance configured for dev (pretty) or prod (JSONL). |
| Request Wrapper | `src/lib/with-logging.ts` | HOF that wraps API route handlers. Logs `request_start`/`request_complete`/`request_error`. |
| Migration Script | `scripts/migrate.ts` | Wrapper around `prisma migrate deploy` with structured logging. |
| Updated Routes | `src/app/api/*/route.ts` | Wrapped with `withLogging`; manual `console.*` replaced with `logger.*`. |

### Logger Configuration

- **Dev (`NODE_ENV=development`):** Uses `pino-pretty` transport for human-readable output. Same fields, just formatted.
- **Prod (`NODE_ENV=production`):** Outputs newline-delimited JSON (JSONL). Each line is a self-describing log object with `level`, `time`, `msg`, and any custom fields.
- **Log levels:** `trace`, `debug`, `info`, `warn`, `error`, `fatal`. Default `info` in prod, `debug` in dev.
- **Redaction:** No secrets are logged. Request bodies are not logged. Query params are logged (they are not sensitive in this app).

### Request Wrapper (`withLogging`)

```typescript
export function withLogging<T>(
  handler: (req: Request | NextRequest, context?: T) => Promise<Response>
): (req: Request | NextRequest, context?: T) => Promise<Response>
```

**Behavior:**
1. Generate a UUID for `requestId`.
2. Extract `pathname` from `req.url` via `new URL(req.url).pathname`. If it is `/api/health/live` or `/api/health/readiness`, skip logging entirely and return `handler(req, context)`.
3. Log `level: info`, `msg: request_start`, `method`, `path`, `requestId`.
4. Record `startTime = performance.now()`.
5. Call `handler`.
6. If it throws, log `level: error`, `msg: request_error`, `error`, `requestId`, then re-throw.
7. On completion, log `level: info`, `msg: request_complete`, `status`, `durationMs`, `requestId`.
8. Return the response.

### Migration Script

```typescript
// scripts/migrate.ts
import { logger } from '../src/lib/logger';
import { execSync } from 'child_process';

const start = performance.now();
logger.info('migration_start');
try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  logger.info({ durationMs: Math.round(performance.now() - start) }, 'migration_complete');
} catch (error) {
  logger.error({ error: error instanceof Error ? error.message : String(error), durationMs: Math.round(performance.now() - start) }, 'migration_failed');
  process.exit(1);
}
```

**Note:** The Helm job command changes from `npm run db:migrate` to `node scripts/migrate.js`.

**Dockerfile changes:** The `builder` stage compiles `scripts/migrate.ts` to `scripts/migrate.js` using `tsc` (TypeScript is already a devDependency). The `runner` stage copies `scripts/migrate.js` into the container. This avoids needing `tsx` at runtime, per project conventions.

### Cron Job Observability

The CronJob does not need its own script. It already curls `/api/cron/daily-summary`. That API route will be wrapped with `withLogging`, so every cron invocation produces:
- `request_start` with method `GET`, path `/api/cron/daily-summary`
- `request_complete` with status and duration
- If the handler fails, `request_error`

### Updated Routes

All API routes are wrapped with `withLogging`:
- `src/app/api/tmdb/search/route.ts`
- `src/app/api/jellyfin/check/route.ts`
- `src/app/api/requests/[id]/route.ts`
- `src/app/api/cron/daily-summary/route.ts`
- `src/app/api/health/live/route.ts` (excluded from logging via skip list)
- `src/app/api/health/readiness/route.ts` (excluded from logging via skip list)

All existing `console.log/error` calls are replaced with `logger.info/error`:
- `src/app/api/cron/daily-summary/route.ts`
- `src/lib/notifications.ts`
- `src/app/page.tsx`
- `src/components/RequestListItem.tsx`
- `src/app/api/jellyfin/check/route.ts`
- `src/app/api/requests/[id]/route.ts`
- `src/app/api/tmdb/search/route.ts`
- `scripts/daily-summary.ts` (kept for local dev use, but updated to use logger)
- `tests/seed.ts` (kept for test use, updated to use logger)

## Dependencies

- `pino` — production logger
- `pino-pretty` — dev-time pretty printer

## Helm Changes

- `helm/templates/job-db-migrate.yaml`: Change `command` from `npm run db:migrate` to `node scripts/migrate.js`.
- `Dockerfile`: Add a build step to compile `scripts/migrate.ts` → `scripts/migrate.js`, and copy the `.js` file into the `runner` stage.
- No changes to `cronjob-daily-summary.yaml` — it already invokes the API route.

## Testing

- **Unit test `src/lib/__tests__/with-logging.test.ts`:**
  - Verify `request_start` and `request_complete` are logged with correct fields.
  - Verify thrown errors log `request_error` and are re-thrown.
  - Verify `/api/health/live` and `/api/health/readiness` are skipped.
- **Unit test `src/lib/__tests__/logger.test.ts` (optional):** Verify JSON output in production mode.
- **Integration:** Run `npm run dev`, hit an API route, inspect terminal output.

## Out of Scope

- Client-side browser logging.
- A new log viewer or dashboard (Loki/Grafana already handle this).
- Sampling or log rate limiting (not needed at current scale).
- Distributed tracing (OpenTelemetry).

## Open Questions

- None at this time.
