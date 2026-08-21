# ADR-0008: Auto-Match Suggestions for Torrent↔Request Pairing

## Status

Accepted (2026-08-21).

## Context

ADR-0005 made Transmission a read-only observed downloader: the operator must explicitly pick a torrent and link it to a `pending` Request. That works, but as the Transmission library grows the operator spends time scanning the list for the right torrent. The question is how MovieDB can *suggest* the right torrent without ever making the link automatically.

The relevant precedents are:

- ADR-0005 — read-only Transmission posture; no auto-link; "needs match" is a derived view (`status = 'pending' AND torrent_hash IS NULL`).
- ADR-0007 — the `request-lifecycle` module owns all lifecycle writes and side-effects; no new FSM statuses.
- Wayfinder ticket [#55](https://github.com/kevbob1/moviedb/issues/55) — chose `@viren070/parse-torrent-title` as the release-name parser.
- Wayfinder ticket [#58](https://github.com/kevbob1/moviedb/issues/58) — defined the matcher algorithm (token-set Jaccard, eligibility gates, deterministic tie-breaks).

This ADR is the canonical spec that the implementation tickets will follow.

## Decision

MovieDB will compute a **single best-match suggestion** for every `pending` Request that has no linked torrent, surface it on the Needs Match view, and let the operator confirm it through the existing `linkTorrent` verb. The feature is suggestion-only; auto-link is out of scope.

### Posture

- Suggestion-only. The operator always confirms via `linkTorrent`; MovieDB never transitions a Request out of `pending` on its own.
- ADR-0005's read-only posture is preserved: Transmission is still observed, never driven.
- ADR-0007's FSM invariants are preserved: no new Request status is added; "needs match" remains a derived view.

### Matching signals

- The matcher consumes each torrent's `name` and the list of contained filenames from Transmission (`files`).
- Release-name parsing is performed by `@viren070/parse-torrent-title`.
- The matcher is a pure function in `src/lib/matcher/` with no DB or HTTP dependencies.

### Eligibility and scoring

The matcher evaluates every torrent as a candidate for a given Request. A candidate must pass all four eligibility predicates; if any fail, the candidate is rejected with `score: 0` and a reason string.

1. **Title parsed.** If the parser cannot produce a `title`, the candidate is dropped.
2. **Media-type filter.**
   - `movie` requests only match torrents with no season signal.
   - `tv` requests only match torrents with a season signal.
3. **Year disambiguation.** When both the Request's `release_date` year and the torrent's parsed year are present, they must match. A missing year on either side falls through to title-only scoring.
4. **TV season signal.** When `Request.season_number` is set, the torrent must be a season pack (`parsed.complete === true`) and `parsed.seasons` must include the requested season. Single-episode torrents are not eligible for a season Request.

Title similarity is token-set Jaccard on normalised titles: lowercase, strip non-alphanumeric, drop release-metadata noise tokens (resolution, codec, source, edition, HDR, audio), drop the year token, and drop the trailing release group. The score is `|A ∩ B| / |A ∪ B|` in the range `[0, 1]`.

Top-1 selection per Request:

- Filter to eligible candidates.
- Pick the highest score.
- Tie-break on equal score, in order:
  1. Higher resolution (`2160p` > `1080p` > `720p`).
  2. Higher quality (`BluRay`/`Remux` > `WEB-DL`/`WEBRip` > `HDTV`).
  3. First-seen in the Transmission torrent list (insertion order).

If no candidate is eligible, the Request has no suggestion.

### Suggestion value object

A `MatchSuggestion` carries:

- `hash` — the Transmission torrent hash.
- `score` — the Jaccard score `[0, 1]`.
- `eligible` — `true` only when all predicates pass.
- `reasons` — human-readable predicate failures when `eligible` is `false`.

Only the single best suggestion per Request is persisted; there is no history table.

### Persistence

Three nullable columns are added to `Request`:

- `suggestion_hash String?`
- `suggestion_score Float?`
- `suggestion_computed_at DateTime?`

They carry the latest top-1 suggestion only. The projection (`projection.ts`) exposes these fields so the UI can read them.

### Lifecycle

The suggestion fields are cleared on every transition out of `pending` (`pending → downloading` via `linkTorrent`, `pending → fulfilled` if that path ever applies, and deletion via `cancelRequest`). The clear is performed by the `request-lifecycle` module as part of the existing transition side-effects.

### Where it runs

Matching piggybacks the existing `transmission_sync` cron job (`src/lib/jobs/transmission-sync.ts`). On each run the job:

1. Fetches the full Transmission torrent list (the operator-pick surface already needs it).
2. Loads all `pending` Requests with `torrent_hash IS NULL`.
3. Calls the matcher.
4. Writes the top-1 suggestion (or a null wipe if the previous suggestion no longer holds) to the three columns.

No new job type or cron schedule is introduced unless ticket #60 discovers a strong reason for one.

### Surfaces

Two surfaces show the same suggestion data:

1. **Suggestions section** — a dedicated panel above the existing Unmatched Requests and Transmission Torrents columns on `/needs-match`.
2. **Inline badge** — a badge on each unmatched Request card.

Both surfaces show the score visibly. The exact shape of "visible" (numeric, colour band, "low confidence" label, dismiss control) is left to the inline-badge prototype ticket (#57). A Dismiss control, if offered, only clears the persisted suggestion for that Request until the next `transmission_sync` pass re-evaluates it.

### Cross-media, year, and season rules

- Candidates are filtered by `media_type` before scoring.
- Year match is an eligibility gate, not a score bonus.
- Season match requires a season pack; the operator will wait for a pack rather than accept a single episode for a season Request.
- Multi-season packs that include the requested season are eligible; the operator decides whether to accept them.

## Considered Options

- **Auto-link without operator confirmation.** Rejected by ADR-0005: silent wrong-matches would corrupt the FSM. Re-linking without a human is a separate, fresh effort if it is ever wanted.
- **Top-K multi-candidate UX.** Rejected: the map scoped this to single best match to keep the UI and persistence simple. A list of candidates can be added later without changing the persistence model.
- **TMDB-driven matching.** Rejected: matching uses parsed torrent metadata only. TMDB ID resolution would make the matcher dependent on TMDB availability and complicate offline operation.
- **Threshold suppression (hide low scores).** Rejected: the operator should always see the top-1 with its score. A low score is itself a signal to inspect carefully.
- **A separate `match_suggestions` job type.** Rejected for v1: the existing `transmission_sync` job already loads the torrent list and runs on a bounded cadence. Extending it keeps the schedule in one place. If cadence or load becomes a problem, splitting is a future option.
- **A `match_candidate` history table.** Rejected: the feature only needs the latest suggestion. History adds storage and UI complexity for a v1 suggestion-only feature.
- **Re-linking a different torrent to a `downloading` Request.** Rejected: already out of scope per ADR-0005's recovery-gap note.

## Consequences

- One new ADR (this file) becomes the spec for the implementation tickets.
- One new module: `src/lib/matcher/` — pure function, no DB/HTTP dependencies, independently testable.
- One new dependency: `@viren070/parse-torrent-title`.
- Three new nullable columns on `Request` (`suggestion_hash`, `suggestion_score`, `suggestion_computed_at`).
- `src/lib/jobs/transmission-sync.ts` gains suggestion computation and persistence.
- `src/lib/request-lifecycle/projection.ts` exposes suggestion fields in the UI model.
- `src/lib/request-lifecycle/fsm.ts` (or `repository.ts`) clears suggestion fields on transitions out of `pending`.
- `src/app/needs-match/page.tsx` and `src/components/NeedsMatchView.tsx` gain a Suggestions section and inline badges.
- No new FSM status; "needs match" remains a derived view.
- The operator remains the only actor who can move a Request out of `pending`.

## Pointer

- `docs/adr/0005-transmission-read-only-observation.md` — read-only Transmission posture.
- `docs/adr/0007-request-lifecycle-module.md` — lifecycle module layout.
- `src/lib/matcher/` — new matcher module (ticket #58 algorithm).
- `src/lib/transmission/adapter.ts` and `catalog.ts` — Transmission seam; must expose torrent `files`.
- `src/lib/jobs/transmission-sync.ts` — cron extension for computing suggestions.
- `src/lib/request-lifecycle/` (`repository.ts`, `fsm.ts`, `projection.ts`) — lifecycle writes and UI projection.
- `src/app/needs-match/page.tsx` and `src/components/NeedsMatchView.tsx` — surfaces.
