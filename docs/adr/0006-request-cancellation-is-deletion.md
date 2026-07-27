# ADR-0006: Request Cancellation Is Deletion; Resolved Requests Are Cleaned Up by Cron

## Status

Accepted (2026-07-26).

## Context

The `requests` table accumulates terminal rows forever. The operator asked for a cleanup cron removing old `fulfilled`/`canceled` Requests, which forced two latent questions: what timestamp anchors "old" (the table had only `requested_at`), and whether `canceled` earns its keep as a state at all. The app has no auth and `requested_by` is an opaque hint, so the `canceled` row was providing accountability theater, not accountability — anyone can cancel anyone's Request, and the row only records that *someone* did.

## Decision

- **Cancellation is deletion.** The `canceled` status is retired; the Request lifecycle is `pending → downloading → fulfilled` with a single terminal state. "Cancel" is an operation that removes the row, not a transition. No trace is kept beyond logs.
- **`resolved_at` (nullable `DateTime`) is added to `Request`**, set when a Request enters `fulfilled` — including the auto-fulfill write inside the `transmission_sync` job, which bypasses `transitionToStatus`. NULL while active.
- **A new `/api/cron/cleanup-requests` route** (CRON_SECRET bearer, same shape as the other crons) hard-deletes `fulfilled` rows older than `REQUEST_RETENTION_DAYS` (env, ConfigMap-injected, default 5). Invoked daily (`17 3 * * *`) by a dedicated K8s CronJob.
- **Cleanup touches only the `requests` table.** Torrents in Transmission are never removed (consistent with ADR-0005's read-only posture; removing data for a `fulfilled` item could break playback if the library hardlinks).
- **Migration:** existing `fulfilled` rows are backfilled `resolved_at = requested_at` (a wrong-but-conservative proxy — it understates resolution age, so anything deleted under backfill was genuinely old). Existing `canceled` rows are deleted outright.

## Considered Options

- **Anchor cleanup on `requested_at`, no schema change.** Rejected: a Request that sat `pending` for months and fulfilled yesterday would be deleted immediately — exactly the freshly-resolved rows an operator most wants to see.
- **Keep `canceled`, clean it via the same cron.** Rejected: the state carried no actionable information (no auth, opaque requester), and retiring it fixes a live bug — `createRequest` dedup on `(tmdb_id, season_number)` used to return the dead `canceled` row and silently create nothing on re-request. With cancel-as-delete, re-requesting works.
- **Per-status retention knobs.** Rejected: one more env var nobody tunes; splitting later is a one-line `where` change.
- **Remove the linked torrent from Transmission on cleanup.** Rejected: out of scope, and dangerous for hardlinked libraries (see ADR-0005).
- **Fold cleanup into the every-minute `process-jobs` run.** Rejected: 1,440 pointless delete queries per day and a route whose name lies about its responsibilities.

## Consequences

- Amends ADR-0005: "operator can cancel and re-request" now means "operator deletes and re-requests"; the needs-attention section's Cancel verb deletes the row. The re-linking recovery gap it acknowledges is unchanged.
- `RequestStatus` shrinks to three values; `STATUS_CONFIG`, pills, filters, and the FSM tests lose a branch.
- Deleted-while-`downloading` Requests leave their torrent seeding unobserved in Transmission (same posture as a `canceled` row before — the sync job scans from the DB, so a missing row is simply never queried).
- After retention expires, the only record of a fulfilled Request is the Jellyfin library itself — which the glossary already treats as the source of truth for availability.
