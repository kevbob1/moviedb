# ADR-0009: Auto-Link High-Confidence Match Suggestions

## Status

Accepted (2026-09-07). Partially supersedes ADR-0008: the suggestion-only posture and the "auto-link without operator confirmation" rejection are reversed. ADR-0008's matcher algorithm, eligibility gates, scoring, persistence, and surfaces stand unchanged.

## Context

ADR-0008 established suggestion-only matching for `pending` Request ↔ Transmission torrent pairing and explicitly rejected auto-link: "silent wrong-matches would corrupt the FSM" and "MovieDB never transitions a Request out of `pending` on its own." The suggestion workflow proved the matcher's accuracy in practice (token-set Jaccard with title, media-type, year, and season eligibility gates), but the operator still confirms every link by hand, and that confirmation adds no value for near-identical matches — a raw score of `0.90` or higher with every gate passed is a near-identical title. The question resurfaced: should high-confidence suggestions link themselves?

## Decision

Yes — at high confidence, matching links itself. The matcher's per-Request threshold bands become:

- score < `0.50` — no suggestion (unchanged).
- `0.50` ≤ score < `0.90` — suggestion surfaced for operator confirmation via the existing `linkTorrent` verb (unchanged).
- score ≥ `0.90` (inclusive) — **auto-link**: the Request is linked without operator action. The lifecycle link path (the same pure-database bookkeeping `linkTorrent` performs) sets `torrent_hash` and transitions the Request `pending → downloading`.

All ADR-0008 eligibility gates remain mandatory for auto-link; only an eligible top-1 candidate can trigger it. There is no ambiguity margin and no consecutive-pass hold: a raw ≥ `0.90` eligible score links on the first qualifying sync pass.

### Torrent claims

A torrent is **claimed** while its hash appears as `torrent_hash` on any existing Request row — `pending`, `downloading`, or `fulfilled`. The matcher excludes claimed torrents from every Request's candidates. Cancellation (deletion) releases a claim; fulfillment keeps it.

When multiple `pending` Requests contend for the same torrent in one pass, the pass allocates in order: `season_number` ASC, then `requested_at` ASC, then `id` ASC. The first Request in that order claims the torrent; the losing Requests get no suggestion that pass (there is no next-best candidate — top-1 only) and retry the next pass. Lowest season wins; ties resolve by oldest Request.

The claim governs the automatic matcher only. `linkTorrent` stays unrestricted: an operator may deliberately link a claimed torrent — for example, a seasons-1–2 pack auto-linked to the Season 1 Request can still be manually linked to the Season 2 Request.

### Consequences accepted

- No operator veto and no new FSM transitions. Wrong auto-match recovery remains cancel + re-request; because cancellation releases the claim, a re-requested title can re-claim the same torrent within one sync pass. Accepted: a ≥ `0.90` gate-passing match being wrong is a data problem, not a linking problem.
- One `logger.info` line per auto-link (Request id, torrent hash, score). No audit table, no UI, no feature flag.
- ADR-0005's Transmission posture is unchanged in substance: auto-link is bookkeeping on the MovieDB side; Transmission is still observed, never driven.

## Considered Options

- **Suggestion-only forever (status quo, ADR-0008).** Rejected: at `0.90`+ with all gates passed, operator confirmation adds latency without adding correctness.
- **Shared torrent claims** (one torrent serving multiple Requests). Rejected: a torrent serves one Request. Multi-season packs auto-link to the lowest-season Request only; later seasons wait for their own torrents or a deliberate manual link.
- **Ambiguity margin / N-consecutive-pass hold before auto-linking.** Rejected: with title, year, media-type, and season gates passed, a `0.90` Jaccard is decisive; the extra machinery delays correct links without catching real errors.
- **Per-Request auto-match opt-out (veto toggle or persistent dismissal).** Rejected: another piece of state to maintain; exclusivity plus the high threshold make wrong links rare, and cancel + re-request remains the recovery path.
- **Uniform claim enforcement in `linkTorrent`.** Rejected: it would forbid the exact follow-up that exclusivity creates — manually linking a claimed multi-season pack to a later-season Request.

## Pointer

- `docs/adr/0008-auto-match-suggestions.md` — matcher, thresholds, persistence, surfaces (stands, except its suggestion-only posture).
- `docs/adr/0005-transmission-read-only-observation.md` — Transmission posture (still holds).
- `docs/adr/0007-request-lifecycle-module.md` — the lifecycle link path auto-link uses.
- `src/lib/matcher/`, `src/lib/jobs/compute-request-suggestions.ts`, `src/lib/request-lifecycle/` — implementation homes.
