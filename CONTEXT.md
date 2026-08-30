# MovieDB Domain Context

The single source of truth for domain vocabulary. Use these terms in issue titles, refactor proposals, code, tests, and ADRs. Don't drift to synonyms.

---

## Core concepts

### Request
A user-submitted request for a movie or TV show that is not currently on Jellyfin. Lifecycle: `pending` → `downloading` → `fulfilled`. State machine defined in `src/lib/request-fsm.ts`.

**Status values** (`RequestStatus`):
- `pending` — submitted, no work started
- `downloading` — Jellyfin-side download kicked off
- `fulfilled` — content available on Jellyfin (terminal)

Terminal states: `fulfilled`. No transitions out. Entering the terminal state is called **resolution**; it sets `resolved_at` (NULL while the Request is active).

**Cancellation is deletion.** There is no `canceled` status. Cancelling a Request removes the row entirely — the request never happened, and no trace is kept. "Cancel" is an operation, not a state.

**Fields:** `id`, `title`, `tmdb_id`, `season_number` (TV only), `poster_path`, `release_date`, `overview`, `genre_ids`, `requested_at`, `requested_by`, `status`, `media_type`, `resolved_at`.

### MatchSuggestion
A proposed pairing of a `pending` Request with a Transmission torrent, produced by the matcher and surfaced to the operator for confirmation. It is suggestion-only: it never changes a Request's status on its own. The operator accepts it by invoking the existing `linkTorrent` verb.

A `MatchSuggestion` carries the torrent hash, a title-similarity score, an eligibility flag, and reasons when the candidate is rejected. Only the single best suggestion per Request is kept; there is no suggestion history.

### Job
A unit of asynchronous work enqueued in the `jobs` table and processed by a registered handler. Distinct from a `Request`: a Request is *user intent*; a Job is *work the system owes*.

**Status values** (lowercase, snake_case literals in code):
- `pending` — waiting for a worker
- `processing` — claimed by a worker, in flight
- `completed` — handler returned successfully (terminal)
- `failed` — handler raised and retries exhausted, or no handler registered (terminal)

A `processing` job that hasn't updated in 5 minutes is reaped back to `pending` (stuck-job recovery, see `src/lib/job-queue.ts`).

**Type** values are open-set, registered at startup via `registerJobType(type, handler)`. Current registrations:
- `request_notification` — email a user that their request was processed
- `tv_series_request_notification` — TV-specific variant of the above
- `transmission_sync` — observe linked torrents and drive `downloading → fulfilled`; enqueued (deduped) by `/api/cron/process-jobs` every run (ADR-0005)

When referring to a Job's `type` in docs or logs, use the registered string verbatim.

### Jellyfin (catalog)
The media server whose library the app reflects. A `JellyfinCatalog` exposes the questions callers actually ask ("is X on Jellyfin?", "what seasons of show X exist?") and delegates transport to a `JellyfinAdapter` seam.

- **Port**: `JellyfinAdapter { fetchCatalog(), ping() }` (`src/lib/jellyfin/adapter.ts`)
- **Adapters**: `HttpJellyfinAdapter` (production), `InMemoryJellyfinAdapter` (tests)
- **Catalogue data**: `JellyfinCatalogData { movies: Set<string>, seasons: Map<string, Set<number>>, error? }` — TMDB IDs as the universal key

"Available" / "on Jellyfin" is a *Jellyfin catalog* question, not a `Request.status === 'fulfilled'` question. The two are related but distinct: a Request can be `pending` while the underlying content is already on Jellyfin.

### TMDB
Third-party movie/TV metadata provider. The app never calls TMDB from the client; all TMDB requests flow through API routes (`/api/**`). Configuration: `TMDB_API_KEY` (Secret), `TMDB_URL` (ConfigMap). See ADR-0001 for the dev-side env story.

---

## People / actors

- **`requested_by`** — opaque string identifying the user who submitted a Request. Not modelled as a separate User entity. The app has no auth surface; this is a hint, not an identity.

---

## Conventions

- **Status enums** are stored as `String` columns in Postgres and typed at the TypeScript boundary via `RequestStatus` / `Job.status` literals. Don't add `enum` types to Prisma unless typecheck enforcement at the DB layer is wanted.
- **Date fields** are stored as `DateTime`. `release_date` on `Request` is intentionally a `String` (year, or year-month-day depending on source) — it does not represent a precise moment.
- **Media type** is `String` with values `movie` | `tv`. Not modelled as a relation; the data is one-table.
- **Identifiers**: TMDB IDs are the cross-system key between TMDB, Jellyfin, and the local `Request` table.

---

## Architecture terms

These are the deepening-skill vocabulary. Use them exactly when writing architecture reviews or refactor proposals.

- **Module** — anything with an interface and an implementation (function, class, package, slice).
- **Interface** — what a caller must know to use the module: types, invariants, error modes, ordering, config. Not just the type signature.
- **Implementation** — the code inside.
- **Depth** — leverage at the interface: lots of behaviour behind a small interface.
- **Seam** — where an interface lives; a place behaviour can be altered without editing in place.
- **Adapter** — a concrete thing satisfying an interface at a seam.
- **Leverage** — what callers get from depth.
- **Locality** — what maintainers get from depth: change, bugs, knowledge concentrated in one place.

**Deletion test:** if you can delete a module and no complexity reappears elsewhere, it was a pass-through.

---

## Pointer to ADRs

- `docs/adr/0001-makefile-compose-dev-stack.md` — Makefile + Compose dev stack (replaces VSCode `.devcontainer/`)
- `docs/adr/0002-warm-cinema-visual-direction.md` — Warm Cinema visual direction (dark, charcoal+amber)
- `docs/adr/0003-mobile-first-a11y.md` — Mobile-first + accessibility baseline
- `docs/adr/0004-ui-primitive-layer.md` — UI primitive layer (CVA + Radix + motion)
- `docs/adr/0005-transmission-read-only-observation.md` — Transmission as a read-only observed downloader
- `docs/adr/0006-request-cancellation-is-deletion.md` — Cancellation is deletion; cron cleanup of resolved Requests
- `docs/adr/0007-request-lifecycle-module.md` — One seam for the Request lifecycle
- `docs/adr/0008-auto-match-suggestions.md` — Suggestion-only auto-match for torrent↔request pairing

**Request lifecycle read surface:** the Request lifecycle module owns *all* Request state access behind the `RequestService` interface — not just writes. Reads that were historically imported direct Prisma predicates in API routes now live on the service: `queueStats()` (needs-match / needs-attention counts), `activeRequestsForSummary()` (pending+downloading for the daily summary), `retireResolved(olderThanDays)` (retention cleanup). This keeps the match/retention policy local to the module.
