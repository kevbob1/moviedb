# Match Algorithm

Status: draft — resolves wayfinder ticket #58.
Companion to ADR-0005 (Transmission read-only posture) and ADR-0007 (request lifecycle module).

The matcher takes a list of pending `Request`s and a list of Transmission torrents and produces, for each Request, a single best suggestion (hash + score) or no suggestion. It is a pure function — no DB writes, no side effects, no time-of-day dependencies.

## Parser

`@viren070/parse-torrent-title`, chosen in #55. ESM-only, zero runtime dependencies. The matcher consumes only four parsed fields:

| Field        | Type        | Used for            |
|--------------|-------------|---------------------|
| `title`      | `string?`   | Jaccard similarity  |
| `year`       | `string?`   | Year eligibility    |
| `seasons`    | `number[]?` | Season eligibility  |
| `complete`   | `boolean?`  | Season eligibility gate |

Other parsed fields (`resolution`, `codec`, `quality`, `group`, `languages`, etc.) are discarded for eligibility and scoring but consulted only at tie-break time.

## Eligibility

A candidate must pass **all** of the following predicates. Failure of any predicate sets `eligible: false, score: 0` and records the reason in `reasons[]`.

1. **Parser produced a title.** If `parsed.title === undefined`, the candidate is dropped. No fallback to raw-string matching. Logged as a parser failure for visibility.

2. **Media-type filter.**
   - `Request.media_type === 'movie'` — candidate must NOT have `seasons` set. (A torrents with `seasons` is a TV release.)
   - `Request.media_type === 'tv'` — candidate must have `seasons` set.

3. **Year match (when both sides have a year).** If `Request.release_date` year and `parsed.year` are both present, they must equal. Year-missing on either side falls through to title-only scoring.

4. **Season match for TV.** If `Request.season_number` is set, the candidate must have `parsed.complete === true` **and** `parsed.seasons` must include `Request.season_number`. Single-episode torrents (`seasons:[n], episodes:[m]`) and ranged non-`complete` torrents are NOT eligible for a season Request — the operator will wait for a season pack.

## Scoring — token-set Jaccard

Normalize each title into a token set:

1. Lowercase.
2. Strip everything except `[a-z0-9]+` → list of tokens.
3. Drop noise tokens (resolution, codec, quality source, edition, HDR, audio format):
   - resolution: `1080p`, `720p`, `2160p`, `4k`, `1080i`, `576p`, `480p`
   - codec: `x264`, `x265`, `hevc`, `xvid`, `h264`, `h265`, `avc`, `10bit`, `8bit`
   - quality source: `bluray`, `blu`, `ray`, `web`, `dl`, `webrip`, `hdtv`, `dvdrip`, `bdrip`, `brrip`, `remux`
   - edition: `extended`, `remastered`, `proper`, `repack`, `internal`, `uncut`, `uncensored`, `unrated`, `imax`, `directors`, `cut`, `theatrical`, `criterion`, `deluxe`, `edition`
   - HDR: `hdr`, `hdr10`, `dolby`, `vision`, `dv`
4. Drop the year token (4-digit year, when present) — year is a separate signal handled by the eligibility gate.
5. Drop the release group — the trailing uppercase cluster after the last `-` (e.g. `SWEETNESS` in `Dune.2021.1080p.BluRay.x264-SWEETNESS`).

`score = |A ∩ B| / |A ∪ B|`, where `A` and `B` are the normalised token sets of `Request.title` and `parsed.title`.

**Score range:** `[0, 1]`. Score `0` means no token overlap; score `1` means identical token sets. Score represents *what this torrent is*, not *how good it looks* — there is no resolution/codec bonus applied to the score itself.

## Top-1 selection

For each Request, after evaluating every candidate:

1. Filter to candidates with `eligible: true`.
2. Pick the candidate with the highest `score`.
3. **Tie-break on score equality** (deterministic, stable across runs):
   1. Prefer higher `parsed.resolution`: `2160p` > `1080p` > `720p` (lower resolutions and missing values lose).
   2. On further tie, prefer higher `parsed.quality`: `BluRay`/`Remux` > `WEB-DL`/`WEBRip` > `HDTV` > others.
   3. On further tie, prefer first-seen in the Transmission torrent list (insertion order).

If no candidate is eligible, the Request has no suggestion: `null` suggestion, with the `reasons[]` from the highest-scoring-but-rejected candidate logged for debugging.

## Output shape

```ts
interface MatchSuggestion {
  hash: string;        // torrent hash, identifies the candidate
  score: number;       // [0, 1]; 0 when not eligible
  eligible: boolean;   // true only when all four predicates pass
  reasons: string[];   // empty when eligible; otherwise which predicates failed
}
```

The matcher's top-level output:

```ts
export function matchSuggestions(
  requests: Request[],
  torrents: TransmissionTorrent[],
): Map<string, MatchSuggestion | null>;  // null = "no eligible candidate"
```

`reasons[]` is structured but free-form — `"year mismatch: 2020 vs 2021"`, `"season not complete: seasons=[1] complete=undefined"`, `"no parsed title"`, `"media_type mismatch: tv request vs no-season torrent"`. The matcher logs the reasons of the best-rejected candidate when no eligible one exists, so operators can see why nothing matched.

## Worked examples

### 1. Confident movie match

- Request: `{ title: "Dune", media_type: "movie", release_date: "2021-10-22" }`
- Torrent name: `Dune.2021.1080p.BluRay.x264-SWEETNESS`
- Parsed: `{ title: "Dune", year: "2021", resolution: "1080p", quality: "BluRay", codec: "x264", group: "SWEETNESS" }`
- Eligibility: title ✓, media_type (no `seasons`) ✓, year (2021 = 2021) ✓.
- Normalised tokens: Request `{dune}`, torrent `{dune}`.
- Score: `|{dune} ∩ {dune}| / |{dune} ∪ {dune}| = 1.0`.
- Suggestion: `{ hash: "...", score: 1.0, eligible: true, reasons: [] }`.

### 2. Year-disqualified movie

- Request: `{ title: "Dune", media_type: "movie", release_date: "1984-12-14" }` (the Lynch version)
- Torrent name: `Dune.2021.1080p.BluRay.x264-SWEETNESS`
- Eligibility: title ✓, media_type ✓, year (1984 ≠ 2021) ✗.
- Suggestion: `eligible: false, score: 0, reasons: ["year mismatch: 1984 vs 2021"]`.
- Request has no suggestion.

### 3. Season-disqualified TV (single episode)

- Request: `{ title: "Severance", media_type: "tv", season_number: 1 }`
- Torrent name: `Severance.S01E03.720p.HDTV-GROUP`
- Parsed: `{ title: "Severance", seasons: [1], episodes: [3], resolution: "720p", quality: "HDTV", complete: undefined }`
- Eligibility: title ✓, media_type (seasons present) ✓, season gate (`complete` not true) ✗.
- Suggestion: `eligible: false, score: 0, reasons: ["season not complete: seasons=[1] complete=undefined"]`.
- Request has no suggestion (operator waits for a season pack).

### 4. No-eligible-candidate case (unrelated torrent)

- Request: `{ title: "Severance", media_type: "tv", season_number: 1 }`
- Torrent name: `Some.Unrelated.Show.S02.COMPLETE.1080p.WEB-DL.x264-GROUP`
- Parsed: `{ title: "Some Unrelated Show", seasons: [2], complete: true }`
- Eligibility: media_type (seasons=[2] ≠ Request season 1) ✗.
- Suggestion: `eligible: false, score: 0, reasons: ["season mismatch: request=1 vs torrent=2"]`.
- Request has no suggestion.

### 5. Multi-season pack (edge case)

- Request: `{ title: "Breaking Bad", media_type: "tv", season_number: 1 }`
- Torrent name: `Breaking.Bad.Season.1-5.Complete.1080p.BluRay.x265.HEVC.10bit`
- Parsed: `{ title: "Breaking Bad", seasons: [1,2,3,4,5], complete: true }`
- Eligibility: title ✓, media_type ✓, season gate (seasons includes 1 AND complete is true) ✓.
- Normalised tokens: `{breaking, bad}` vs `{breaking, bad}`.
- Score: `1.0`.
- Suggestion: `{ hash: "...", score: 1.0, eligible: true, reasons: [] }`. Operator decides whether to accept a multi-season pack; matcher surfaces it.

## Module location

`src/lib/matcher/` — a new directory, sibling to `src/lib/request-lifecycle/` and `src/lib/transmission/`. The matcher is a pure function; it has no DB or HTTP dependencies. The `transmission_sync` job extension (#60) calls it.

## What this spec does NOT decide

- **Cron cadence / refresh-button behaviour.** The matcher runs on whatever cadence the caller invokes it at — left to ticket #60 (Extend `transmission_sync` to compute and persist suggestions).
- **Test fixtures.** How tests get realistic torrent names / filenames — a small `__fixtures__/` set or synthetic generators. Implementation ticket.
- **Score visibility shape.** What the score looks like in the UI (numeric vs banded vs label) — left to the inline-badge prototype (#57) and the Suggestions section (#61).
- **Parser failure telemetry.** What gets logged and where. Implementation ticket.
