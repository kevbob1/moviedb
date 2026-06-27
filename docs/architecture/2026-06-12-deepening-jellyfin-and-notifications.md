# Deepening Spec — Jellyfin Catalog & Notifications

Two architectural deepening candidates, fully grilled. Each is presented with the same structure: problem, deep-module shape, file layout, interface (verbatim), migration map, tests, deletion list.

> **Vocabulary.** Module · Interface · Implementation · Depth · Seam · Adapter · Leverage · Locality. The interface is the test surface.

---

## 1. Jellyfin Catalog

### Problem

`src/lib/jellyfin.ts` (251 lines) exposes seven public functions for one underlying capability: "ask Jellyfin what it has." Six of the seven are reshapers around the one that has logic (`getJellyfinTmdbIds`). Three different return envelopes — `JellyfinStatus`, `JellyfinCheckResult`, `JellyfinAvailabilityResult` — describe the same answer in three shapes. Two of the seven functions are never called outside the file. Cache state lives in module-level mutable `let` variables, with a public `invalidateJellyfinCache` that has zero production callers (only test `beforeEach`).

**Deletion test.** Deleting `isMovieOnJellyfin` and `checkAvailability` removes zero capability. Deleting `checkMovieOnJellyfin` removes one caller's rewrap. Deleting the cache invalidate function removes zero production capability. The module's *real* interface is one operation (is X on Jellyfin) and one question (what seasons of show X), plus a sibling connectivity probe.

### Deep-module shape

```
                          ┌──────────────────────────┐
   callers (route, RSC)   │  JellyfinCatalog         │   external seam
   ────────────────────►  │  ─ isOnJellyfin(id)      │  ───────────────
                          │  ─ seasonsFor(id)        │
                          │  ─ availabilityFor(ids)  │
                          │  ─ seasonsForMany(ids)   │
                          │  ─ ping()                │
                          │  ── internal seam ──     │
                          │  ▼                       │
                          │  JellyfinAdapter port    │
                          │  ─ fetchCatalog()        │
                          │  ─ ping()                │
                          └────┬────────────┬────────┘
                               │            │
                          HttpAdapter   InMemoryAdapter
                          (prod)        (tests)
```

- **External seam** at `JellyfinCatalog`. Test surface for production callers and for the lib's own tests.
- **Internal seam** at `JellyfinAdapter`. Production uses `HttpJellyfinAdapter`; tests inject `InMemoryJellyfinAdapter`. Two adapters → real seam.
- Cache is a private field of the catalog instance. TTL preserved (5 min).
- No module-level mutable state. No `invalidate*` export.

### File layout

```
src/lib/jellyfin/
├── index.ts          # public surface: factory, default exports, types
├── catalog.ts        # createJellyfinCatalog(adapter, opts): JellyfinCatalog
├── adapter.ts        # HttpJellyfinAdapter, InMemoryJellyfinAdapter, JellyfinAdapter port
└── __tests__/
    ├── catalog.test.ts        # in-memory adapter — behavior specs
    └── http-adapter.test.ts   # mocked fetch — pagination, ping, error shapes
```

`src/lib/jellyfin.ts` is deleted; `src/lib/jellyfin/index.ts` replaces its role via Next.js auto-resolution of `@/lib/jellyfin` (no import-path changes for callers).

### Interface (verbatim)

```ts
// src/lib/jellyfin/adapter.ts

export interface JellyfinCatalogData {
  movies: Set<string>;                                  // TMDB IDs owned
  seasons: Map<string, Set<number>>;                    // TMDB ID → season numbers
  error?: string;                                       // "not configured" or HTTP error
}

export interface JellyfinAdapter {
  fetchCatalog(): Promise<JellyfinCatalogData>;
  ping(): Promise<{ reachable: boolean; error?: string }>;
}

export class HttpJellyfinAdapter implements JellyfinAdapter {
  constructor(opts?: { url?: string; apiKey?: string }) {
    // Default to process.env.JELLYFIN_URL / JELLYFIN_API_KEY
  }
  async fetchCatalog(): Promise<JellyfinCatalogData> { /* current getJellyfinTmdbIds logic */ }
  async ping(): Promise<{ reachable: boolean; error?: string }> { /* current /System/Info call */ }
}

export class InMemoryJellyfinAdapter implements JellyfinAdapter {
  constructor(data: Partial<JellyfinCatalogData> & { ping?: { reachable: boolean; error?: string } }) {}
  async fetchCatalog(): Promise<JellyfinCatalogData>;
  async ping(): Promise<{ reachable: boolean; error?: string }>;
}
```

```ts
// src/lib/jellyfin/catalog.ts

export interface AvailabilityResult {
  available: boolean;
  configured: boolean;
  error?: string;
}

export interface SeasonsResult {
  seasons: number[];
  configured: boolean;
  error?: string;
}

export interface PingResult {
  configured: boolean;
  reachable: boolean;
  error?: string;
}

export interface JellyfinCatalog {
  isOnJellyfin(tmdbId: number): Promise<AvailabilityResult>;
  seasonsFor(tmdbId: number): Promise<SeasonsResult>;
  availabilityFor(tmdbIds: number[]): Promise<Record<number, AvailabilityResult>>;
  seasonsForMany(tmdbIds: number[]): Promise<Record<number, SeasonsResult>>;
  ping(): Promise<PingResult>;
}

export function createJellyfinCatalog(
  adapter: JellyfinAdapter,
  opts?: { ttlMs?: number }
): JellyfinCatalog;
```

```ts
// src/lib/jellyfin/index.ts

import { createJellyfinCatalog, JellyfinCatalog, AvailabilityResult, SeasonsResult, PingResult } from './catalog';
import { HttpJellyfinAdapter, InMemoryJellyfinAdapter, JellyfinAdapter, JellyfinCatalogData } from './adapter';

export type { JellyfinCatalog, JellyfinAdapter, JellyfinCatalogData, AvailabilityResult, SeasonsResult, PingResult };
export { createJellyfinCatalog, HttpJellyfinAdapter, InMemoryJellyfinAdapter };

// Production default — bound to the HTTP adapter.
const defaultCatalog = createJellyfinCatalog(new HttpJellyfinAdapter());

export const isOnJellyfin = (id: number) => defaultCatalog.isOnJellyfin(id);
export const seasonsFor = (id: number) => defaultCatalog.seasonsFor(id);
export const availabilityFor = (ids: number[]) => defaultCatalog.availabilityFor(ids);
export const seasonsForMany = (ids: number[]) => defaultCatalog.seasonsForMany(ids);
export const ping = () => defaultCatalog.ping();
```

### Migration map (call sites)

| File:line | Before | After |
|---|---|---|
| `src/app/requests/page.tsx:37` | `const jellyfinAvailability = await areMoviesOnJellyfin(tmdbIds);` | `const jellyfinAvailability = await availabilityFor(tmdbIds);` then `Object.fromEntries(Object.entries(jellyfinAvailability).map(([k, v]) => [k, v.available]))` |
| `src/app/requests/[id]/page.tsx:30` | `const availabilityMap = await areMoviesOnJellyfin([tmdbId]); jellyfinAvailability = availabilityMap.get(tmdbId) ?? false;` | `const r = await isOnJellyfin(tmdbId); jellyfinAvailability = r.available;` |
| `src/app/api/jellyfin/check/route.ts:16–17` | `Promise.all([checkMoviesOnJellyfin(ids), checkSeasonsOnJellyfin(ids)])` reshape to `{ results, seasons, configured, error }` | `const [availability, seasons] = await Promise.all([availabilityFor(ids), seasonsForMany(ids)]);` zip to `{ results: availability → available, seasons: seasons → seasons, configured, error }` |
| `src/app/api/health/readiness/route.ts:13` | `checkJellyfinConnectivity()` | `ping()` |

### Tests

`src/lib/jellyfin/__tests__/catalog.test.ts` (new, replaces `src/lib/__tests__/jellyfin.test.ts`):
- One adapter setup pattern: `createJellyfinCatalog(new InMemoryJellyfinAdapter({ movies: ['123', '456'], seasons: { '100': new Set([1, 2]) } }))`.
- Specs at the catalog interface:
  - `isOnJellyfin` returns `available: true` for a known id, `false` for unknown.
  - `isOnJellyfin` returns `configured: false, error: '...'` when adapter reports an error.
  - `seasonsFor` returns the season set, sorted.
  - `availabilityFor` returns a record keyed by id.
  - `seasonsForMany` returns a record with empty arrays for unknown shows.
  - `ping` returns `configured`/`reachable` correctly.

`src/lib/jellyfin/__tests__/http-adapter.test.ts` (new):
- Mocks `global.fetch`. Exercises:
  - Pagination (`TotalRecordCount > 500` → multiple requests).
  - `/System/Info` 200, 401, network error.
  - `JELLYFIN_URL` / `JELLYFIN_API_KEY` missing → `error: 'Jellyfin not configured'`.

Delete: `src/lib/__tests__/jellyfin.test.ts` (311 lines, 7 describe blocks → 2 test files, ~150 lines total).

### Deletion list

- `checkMovieOnJellyfin` ❌
- `checkMoviesOnJellyfin` ❌
- `isMovieOnJellyfin` ❌
- `areMoviesOnJellyfin` ❌
- `checkAvailability` ❌
- `invalidateJellyfinCache` ❌
- Interfaces: `JellyfinStatus`, `JellyfinAvailabilityResult`, `JellyfinCheckResult`, `JellyfinSeasonCheckResult` ❌
- `JellyfinConnectivityResult` → renamed to `PingResult` (kept, narrower name)
- Module-level `let jellyfinTmdbCache`, `let jellyfinSeasonCache`, `let jellyfinCacheTimestamp` ❌
- File `src/lib/jellyfin.ts` ❌ (replaced by `src/lib/jellyfin/`)

### Wins

- **Locality**: bug in catalog logic fixed in one place, not seven.
- **Leverage**: one interface, 2 call sites (list page, route) use batch; 1 (detail page) uses single.
- **Tests**: in-memory adapter is a 5-line constructor; pagination and HTTP errors live in one test file.
- **Cache**: private, encapsulated, no global state, no test-only invalidation knob.

---

## 2. Notifications

### Problem

`src/lib/notifications.ts` (328 lines) contains three near-identical send functions (`sendRequestNotification`, `sendTvSeriesNotification`, `sendDailySummary`), each ~30 lines. Each:

1. Reads 4 env vars (`SMTP_USER`, `SMTP_PASS`, `NOTIFICATION_EMAIL`, `APP_BASE_URL`).
2. Bails with a kind-specific warn log if any is missing.
3. Builds payload-specific content via its own `build*Content` helper (~60 lines each, all share html shell, escape, year).
4. Calls `transporter.sendMail({ from, to, subject, text, html })`.
5. Catches and logs with a kind-specific error message.

SMTP env validation lives in 4 places (once in `getTransporter`, once in each of the 3 senders). The three `build*Content` functions duplicate the html shell (`<!DOCTYPE html><html><head>…</head><body>…<table>…<a style="…">`), the `escapeHtml` helper, the `getYear` helper, the link-button style. Adding a 4th notification type today means ~90 lines of new code (a builder + a sender), all duplicating the shell.

**Deletion test.** Deleting one of the three senders would lose a notification kind. Deleting one of the three builders would lose its html rendering. The duplicated bits — env reads, mailer config, error handling, html shell, escape, year — are pure boilerplate that the module should own once.

### Deep-module shape

```
                          ┌──────────────────────────┐
   callers                │  Notifications module    │   external seam
   ─ sendRequest(payload)─►│  ─ sendRequest(payload)  │  ───────────────
   ─ sendTvSeries(payload)►│  ─ sendTvSeries(payload) │
   ─ sendDailySummary(rs) ►│  ─ sendDailySummary(rs)  │
                          │  ── internal seam ──     │
                          │  ▼                       │
                          │  Mailer port             │
                          │  ─ isConfigured()        │
                          │  ─ send(msg)             │
                          └────┬────────────┬────────┘
                               │            │
                          SmtpMailer    InMemoryMailer
                          (prod)        (tests)
```

- **External seam** at the three named functions. Test surface for both production callers and the lib's own tests.
- **Internal seam** at the `Mailer` port. Production uses `SmtpMailer` (reads env); tests inject `InMemoryMailer`. Two adapters → real seam.
- Renderers live as private internal functions in the module. Pure `(payload, baseUrl) => { text, html, subject }`. Not part of the external interface.
- Kind dispatch is a switch (Q2.2 answer A): small, only 3 kinds, the switch keeps the log message ("Skipping X notification: …") close to the dispatch.

### File layout

```
src/lib/notifications/
├── index.ts            # public surface: factory, default exports, types
├── notifications.ts    # createNotifications(mailer): Notifications; three public send* functions
├── renderers.ts        # private: buildRequestContent, buildTvSeriesContent, buildDailySummaryContent, escapeHtml, getYear
├── mailer.ts           # Mailer port, SmtpMailer, InMemoryMailer
└── __tests__/
    ├── notifications.test.ts  # in-memory mailer — behavior specs at the three send* functions
    └── mailer.test.ts         # SMTP env read, nodemailer transport config
```

`src/lib/notifications.ts` is deleted; `src/lib/notifications/index.ts` replaces it via `@/lib/notifications` resolution.

### Interface (verbatim)

```ts
// src/lib/notifications/mailer.ts

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  isConfigured(): { ok: boolean; reason?: 'smtp' | 'app_base_url' };
  send(msg: { to: string; from: string; message: RenderedEmail }): Promise<void>;
}

export class SmtpMailer implements Mailer {
  // Reads process.env.SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFICATION_EMAIL, APP_BASE_URL.
  // isConfigured() returns { ok: false, reason: 'smtp' } if SMTP_* or NOTIFICATION_EMAIL missing.
  //                            { ok: false, reason: 'app_base_url' } if APP_BASE_URL missing.
  //                            { ok: true } otherwise.
  // send() calls nodemailer.createTransport(...).sendMail(...). Throws on SMTP error.
}

export class InMemoryMailer implements Mailer {
  public sent: Array<{ to: string; from: string; message: RenderedEmail }> = [];
  isConfigured(): { ok: boolean; reason?: 'smtp' | 'app_base_url' };
  async send(msg): Promise<void> { this.sent.push(msg); }
}
```

```ts
// src/lib/notifications/notifications.ts

import { Mailer, RenderedEmail } from './mailer';
import { NotificationRequest, TvSeriesNotificationPayload, renderRequest, renderTvSeries, renderDailySummary } from './renderers';

export interface Notifications {
  sendRequest(payload: NotificationRequest): Promise<void>;
  sendTvSeries(payload: TvSeriesNotificationPayload): Promise<void>;
  sendDailySummary(requests: NotificationRequest[]): Promise<void>;
}

export function createNotifications(mailer: Mailer, opts?: { to?: string; from?: string; baseUrl?: string }): Notifications;
```

> `opts` lets the factory pre-bind `to`/`from`/`baseUrl` from env at construction. Production passes the SMTP mailer and lets the factory read env once. Tests pass an in-memory mailer and override `to`/`from`/`baseUrl` explicitly.

```ts
// src/lib/notifications/index.ts

import { createNotifications, Notifications } from './notifications';
import { SmtpMailer, InMemoryMailer, Mailer, RenderedEmail } from './mailer';

export type { Notifications, Mailer, RenderedEmail, NotificationRequest, TvSeriesNotificationPayload };
export { createNotifications, SmtpMailer, InMemoryMailer };

// Production default — bound to SmtpMailer, env read at module load.
const defaultNotifications = createNotifications(new SmtpMailer());

export const sendRequest = (payload: NotificationRequest) => defaultNotifications.sendRequest(payload);
export const sendTvSeries = (payload: TvSeriesNotificationPayload) => defaultNotifications.sendTvSeries(payload);
export const sendDailySummary = (requests: NotificationRequest[]) => defaultNotifications.sendDailySummary(requests);
```

```ts
// src/lib/notifications/renderers.ts  (private to the module — not re-exported from index.ts)

export interface NotificationRequest { /* same shape as today */ }
export interface TvSeriesNotificationPayload { /* same shape as today */ }

export function renderRequest(payload: NotificationRequest, baseUrl: string): RenderedEmail;
export function renderTvSeries(payload: TvSeriesNotificationPayload, baseUrl: string): RenderedEmail;
export function renderDailySummary(requests: NotificationRequest[], baseUrl: string): RenderedEmail;
```

### Migration map (call sites)

| File:line | Before | After |
|---|---|---|
| `src/lib/jobs/request-notification.ts:2,8` | `import { sendRequestNotification, NotificationRequest } from '../notifications';` … `await sendRequestNotification(payload);` | `import { sendRequest, NotificationRequest } from '@/lib/notifications';` … `await sendRequest(payload);` |
| `src/lib/jobs/tv-series-request-notification.ts:2,14` | `import { sendTvSeriesNotification } from '../notifications';` … `handle: sendTvSeriesNotification` | `import { sendTvSeries } from '@/lib/notifications';` … `handle: sendTvSeries` |
| `src/app/api/cron/daily-summary/route.ts:2,31` | `import { sendDailySummary } from '@/lib/notifications';` … `await sendDailySummary(requests);` | `import { sendDailySummary } from '@/lib/notifications';` (no change to the name) |
| `src/lib/__tests__/notifications.test.ts:2` | `import { sendRequestNotification, sendDailySummary, NotificationRequest } from '../notifications';` | `import { createNotifications, InMemoryMailer, NotificationRequest } from '../notifications';` and build a fresh `Notifications` per test from `new InMemoryMailer()`. |

### Tests

`src/lib/notifications/__tests__/notifications.test.ts` (new, replaces `src/lib/__tests__/notifications.test.ts`):
- One fixture per test: `const notif = createNotifications(new InMemoryMailer(), { to: 'admin@example.com', from: 'a@b', baseUrl: 'https://x' });`
- Specs at the `Notifications` interface:
  - `sendRequest` calls `mailer.send` once with the right subject/text/html.
  - `sendRequest` escapes HTML in title, requester name, status.
  - `sendRequest` handles year variants: valid `YYYY-MM-DD`, `null`, `undefined`, garbage.
  - `sendRequest` does NOT throw when `mailer.send` rejects; logs an error.
  - `sendRequest` is a no-op (does not call `mailer.send`) when mailer is not configured; logs a warn with the kind.
  - Same three specs for `sendTvSeries` and `sendDailySummary`.
  - `sendDailySummary` with empty array renders the "No active requests" message.

`src/lib/notifications/__tests__/mailer.test.ts` (new):
- `SmtpMailer`:
  - `isConfigured` returns `{ ok: false, reason: 'smtp' }` when any of `SMTP_USER`/`SMTP_PASS`/`NOTIFICATION_EMAIL` missing.
  - `isConfigured` returns `{ ok: false, reason: 'app_base_url' }` when `APP_BASE_URL` missing but SMTP vars present.
  - `isConfigured` returns `{ ok: true }` when all set.
  - `send` calls `nodemailer.createTransport` with the right host/port/auth and `sendMail` with the right payload.
  - `send` propagates SMTP errors (does not catch).

Delete: `src/lib/jobs/__tests__/request-notification.test.ts` and `src/lib/jobs/__tests__/tv-series-request-notification.test.ts` — these test the trivial `registerJobType` wrapper, which is structural and best left to a single `job-queue.test.ts` integration test (already covered by `src/lib/__tests__/job-queue.test.ts`).

### Deletion list

- `sendRequestNotification` ❌ (replaced by `sendRequest`)
- `sendTvSeriesNotification` ❌ (replaced by `sendTvSeries`)
- `sendDailySummary` ✅ (kept, same name)
- `getTransporter` (private) ❌ (lives in `SmtpMailer` now)
- `buildRequestNotificationContent`, `buildTvSeriesNotificationContent`, `buildDailySummaryContent` (private) ❌ (replaced by `renderRequest` / `renderTvSeries` / `renderDailySummary`)
- `escapeHtml`, `getYear` (private) ❌ (live in `renderers.ts` as private; no external seam)
- `NotificationRequest` interface ✅ (kept, moved to `renderers.ts`, re-exported)
- `TvSeriesNotificationPayload` interface ✅ (kept, moved to `renderers.ts`, re-exported)
- 3× env read block (lines 238–251, 265–278, 298–311) ❌ (one read at `SmtpMailer` construction)
- 3× `try { sendMail } catch { log }` block ❌ (one at `Notifications.sendRequest`/etc.)
- File `src/lib/notifications.ts` ❌ (replaced by `src/lib/notifications/`)

### Wins

- **Locality**: SMTP env read lives in `SmtpMailer` only; html shell in `renderers.ts` only; kind-specific rendering in one function per kind.
- **Leverage**: 3 send functions × ~30 lines → 3 send functions × ~6 lines (the dispatch + render + send). Net: ~200 lines deleted from `notifications.ts` (328 → ~130).
- **Tests**: in-memory mailer is a 5-line constructor; HTML escaping, year parsing, and shell layout are tested in one place against the three renderers.
- **Adding a 4th kind** (e.g. weekly digest) = 1 new `render*` function in `renderers.ts` + 1 new branch in the dispatch switch in `notifications.ts`. No mailer changes. No env changes. No tests in `mailer.test.ts` need to change.
- **No silent failures lost**: the "log error, don't throw" semantics is preserved by `createNotifications(...).sendRequest` wrapping `mailer.send` in try/catch (mirrors today's behaviour exactly).

---

## Shared: Dependency Category & Test Strategy

Both candidates are **remote-but-owned → Ports & Adapters** (DEEPENING.md §3):
- Jellyfin is an internal service you control but is reached over HTTP.
- SMTP is an external service; nodemailer is the adapter.

Both use the same testing strategy: **replace, don't layer** (DEEPENING.md "Testing strategy"). Old unit tests on the seven jellyfin functions and three notification senders become waste once tests at the new module's interface exist — delete them, write new specs against the catalog and the notifications factories with in-memory adapters.

## Verification Checklist (run before declaring done)

1. `npm run check` passes (lint, test, typecheck, build — per AGENTS.md).
2. Both old test files are deleted: `src/lib/__tests__/jellyfin.test.ts`, `src/lib/__tests__/notifications.test.ts`, `src/lib/jobs/__tests__/request-notification.test.ts`, `src/lib/jobs/__tests__/tv-series-request-notification.test.ts`.
3. New test files exist and pass: `src/lib/jellyfin/__tests__/catalog.test.ts`, `src/lib/jellyfin/__tests__/http-adapter.test.ts`, `src/lib/notifications/__tests__/notifications.test.ts`, `src/lib/notifications/__tests__/mailer.test.ts`.
4. `grep -rn "areMoviesOnJellyfin\|checkMovieOnJellyfin\|checkMoviesOnJellyfin\|isMovieOnJellyfin\|checkAvailability\|invalidateJellyfinCache\|checkJellyfinConnectivity" src/` returns zero hits.
5. `grep -rn "sendRequestNotification\|sendTvSeriesNotification\|getTransporter\|buildRequestNotificationContent\|buildTvSeriesNotificationContent\|buildDailySummaryContent" src/` returns zero hits.
6. `src/lib/jellyfin.ts` and `src/lib/notifications.ts` no longer exist as files; `src/lib/jellyfin/index.ts` and `src/lib/notifications/index.ts` do.
7. No `new Response(JSON.stringify(...))` left in `src/app/api/requests/[id]/route.ts` (note: this is out of scope for these two candidates, but worth noting for a future #3).

## Out of Scope (Future Candidates)

These remain on the table from the architecture review and are explicitly NOT addressed by this spec:

- **#3** Extract API route boilerplate into `withApi` HOF (cron auth, CSV id parsing, try/catch/500 shape).
- **#4** Collapse the request status module (FSM + service wrappers + theme re-export).
- **#5** Replace the magic job-handler map.

Once #1 and #2 are landed, the next deepening pass should pick up #3 (cleanest leverage: shrinks 8 route files).
