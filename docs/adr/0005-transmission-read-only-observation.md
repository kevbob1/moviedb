# ADR-0005: Transmission as a Read-Only Observed Downloader

## Status

Accepted (2026-07-26).

## Context

MovieDB needs a downloader so a `pending` Request can move to `downloading` against a real torrent rather than as a manual status flip (the glossary previously claimed "Jellyfin-side download kicked off," which was fictional — Jellyfin integration is read-only catalog). Transmission is a BitTorrent client already in use by the operator. The question was what shape the integration takes: observer, driver, or something in between.

## Decision

Transmission joins Jellyfin as a **read-only observed external system**. MovieDB calls only `torrent-get`-style queries; it never calls `torrent-add`, `torrent-stop`, or `torrent-remove`. The operator owns the torrent lifecycle in Transmission directly:

- Operator adds a torrent in Transmission (out of band).
- MovieDB lists Transmission's torrents so the operator can **explicitly select** one and link it to a `pending` Request; the link is stored as `torrent_hash` on the Request.
- The `pending → downloading` transition gains a precondition: a `torrent_hash` must be set. No new FSM status is added; "needs match" is a derived view (`status = 'pending' AND torrent_hash IS NULL`).
- A linked torrent's progress drives the FSM: `isFinished === true || status === 4` (seeding or stopped-but-complete) fires `downloading → fulfilled`. Progress is observed by a **scheduled cron sync job** (reusing the existing `Job` queue and `/api/cron/process-jobs` route); the sync batch-fetches Transmission state for all `status = 'downloading' AND torrent_hash IS NOT NULL` rows on a ~60s schedule and mutates the FSM in a transaction.
- Transmission-side failures (`error !== 0`) and a linked torrent's disappearance from `torrent-get` are **surfaced to the operator** via a co-located "needs attention" section on the needs-match view (computed from a transient `torrent_problem` text stamp the sync job writes on the Request); they do **not** auto-transition the Request. `downloading → canceled` remains a manual operator action — the only verb offered in the needs-attention section.

## Considered Options

- **MovieDB writes to Transmission** (`torrent-add` on request). Rejected: reopens the torrent-source problem (where does the magnet come from?) and widens the integration to include side-effect reversibility ("did we just remove someone's torrent"). Operator-owned lifecycle keeps the seam narrow and matches the existing Jellyfin posture.
- **Best-effort title/season match, no operator in the loop.** Rejected: torrent `name` fields are wildly variable (release tags, season numbering variants, repacks). Silent wrong-matches would corrupt the FSM — landing a Request in `downloading`/`fulfilled` against the wrong torrent.
- **New `match-pending` FSM status.** Rejected: "needs match" is an operator-attention surface within `pending`, not a lifecycle stage. Inventing a new verb ("acknowledge the request") and a 5th state would cascade through `STATUS_CONFIG`, `PILL_VARIANT`, the `RequestStatus` union, and tests for a UI concept that's cleanly expressible as `status = 'pending' AND torrent_hash IS NULL`.
- **Auto-cancel on Transmission error/disappearance.** Rejected: conflates Transmission's transient problems (tracker dead, disk full, mid-cleanup) with the Request's lifecycle. Operator judgment on transient-vs-real failure is preserved by leaving the manual `cancel` verb as the only cancel path.
- **Lazy poll on page load (like the Jellyfin catalog).** Rejected for the FSM-driving read: Jellyfin's cache is read-only display (availability pills), so staleness is cosmetic — torrent progress *drives the FSM*, so a stuck `downloading` that should've flipped is a correctness gap, not a stale UI. Cron makes the lag bounded and predictable. (The needs-match view's `getAll()` *does* use the lazy-cache pattern — ~30s TTL with a manual refresh — because that surface is display-only.)
- **`TransmissionAdapter` mirrors `JellyfinAdapter` with a single `list()` method.** Rejected: the cron sync only cares about *linked* torrents, and Transmission's `torrent-get` natively accepts an `ids` (hashes) argument for targeted fetch. A single `list()` would pull the operator's *entire* Transmission library every ~60s even when MovieDB links two torrents. The seam is `getTorrents(hashes)`, `getAll()`, `ping()` — targeted for sync, full for operator-pick, readiness for the probe.

## Consequences

- Two new columns on `Request`: `torrent_hash String?` (the Transmission-side cross-system key) and `torrent_problem String?` (a transient operator-attention stamp the sync job writes when it observes an error or a disappeared link; cleared by `transitionToStatus` whenever status changes — cancel and fulfill both null it).
- One new seam: `TransmissionAdapter { getTorrents(hashes: string[]): Promise<Torrent[]>; getAll(): Promise<Torrent[]>; ping(): Promise<{ reachable: boolean; error?: string }> }`. One new catalog wrapper: `createTransmissionCatalog(adapter)` mirroring `createJellyfinCatalog` with a ~30s TTL cache and a manual-refresh escape hatch, backing the needs-match view.
- One new job type, `transmission_sync`, registered via `registerJobType` and enqueued by the cron route. Zero new FSM statuses.
- Transmission joins Jellyfin in the readiness probe pattern (`/api/health/readiness`): `transmission: 'ok' | 'not_configured' | 'error'`.
- Configuration follows the AGENTS.md env rules: `TRANSMISSION_URL` and `TRANSMISSION_USERNAME`/`TRANSMISSION_PASSWORD` injected via ConfigMap/Secret in the Helm chart (URL in ConfigMap, credentials in Secret).
- **Recovery gap (acknowledged, deferred).** A Request whose linked torrent died has no in-app recovery path in v1: MovieDB is read-only so it can't re-link to a replacement torrent, and the only verb the needs-attention view offers is **Cancel**. Operator can cancel and re-request. Re-linking a different torrent to an existing `downloading` Request would reopen the read-only posture (ADR-0005) and is deliberately out of scope.