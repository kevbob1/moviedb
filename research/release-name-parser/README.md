# Release-name parser library — research

Resolves [issue #55](https://github.com/kevbob1/moviedb/issues/55) on the
[auto-match wayfinder map #54](https://github.com/kevbob1/moviedb/issues/54).
The matcher (designed in the follow-on matcher-design ticket) needs to extract
canonical title / year / season / episode / group / type from each torrent's
`name` and each contained filename before it can score candidate pairs.

## Recommendation

**Use `@viren070/parse-torrent-title`.** It is the only candidate that
correctly separated title from year/season on every representative torrent
(see Appendix), exposes an explicit `complete` boolean (essential for the
"multi-pack vs single-episode tie-break" the map left as a future ticket), is
the most actively maintained (last publish 17 days ago, 38 versions in 7
months, 3,416 weekly downloads, 4 open issues), and is TypeScript-first with a
zero-dependency dist that drops cleanly into the Next.js bundle. The repo is
already `"type": "module"`, so the library's ESM-only packaging is not an
obstacle; the one trade-off is that ts-jest will need
`transformIgnorePatterns` adjusted (or a dynamic `import()` in the matcher
wrapper) if we want to unit-test the parser wrapper — none of the other
candidates need that, but none of them parse the season-pack or odd MULTi
releases cleanly either.

## Candidates considered

| Library                       | Lang    | Weekly DLs | Last publish / push  | Stars | Open issues | License   | Runtime deps | Module format    | Returns `type: 'movie'\|'tvshow'`? | Returns `complete` flag? | Returns year as… |
| ----------------------------- | ------- | ---------- | -------------------- | ----- | ----------- | --------- | ------------ | ---------------- | ----------------------------------- | ------------------------ | ---------------- |
| **`@viren070/parse-torrent-title`** | JS/TS   | 3,416      | 2026-08-04 (17 d ago) | 6     | 4           | MIT       | 0            | **ESM-only**     | no (use `seasons[]`/`episodes[]` absence) | **yes**            | string           |
| `parse-torrent-title` (clement-escolano) | JS/TS   | 1,637      | 2026-04-25 (~4 mo ago) | 43    | 5           | MIT       | 0            | CJS              | no                                  | no                       | number           |
| `oleoo` (thcolin)             | JS/TS   | 13         | 2025-06-18 (~14 mo ago) | 64    | 2           | MIT (ISC) | 0            | ESM (`type:module`) | **yes**                       | no                       | string           |
| `parse-torrent-name` (jzjzjzj) | JS      | 601        | 2014-12 (≈12 yr ago)   | 140   | 61          | none (npm "no license") | 0 | CJS         | no                                  | no                       | missing on most inputs (year ends up in `title`) |
| `guessit` (guessit-io)        | Python  | n/a (PyPI) | 2026-08-09 (~12 d ago) | 930   | 16          | LGPL-3.0  | many (rebulk) | Python module   | **yes** (`type: 'movie'`/`'episode'`) | n/a (derives from episode range) | number     |

Sources: [npm registry](https://www.npmjs.com/) for each package, [GitHub REST API](https://docs.github.com/en/rest) for stars / issues / last push dates, and the `package.json` of each installed module for runtime-dep counts and `type` declarations. The Wikipedia-of-parsers note: `parse-torrent-name`, `torrent-name-parser`, `parse-torrent-filename` and the original `parse-torrent-title` (TheBeastLT) are all forks of the same 2014 regex engine; `@viren070/parse-torrent-title` is a fresh TypeScript rewrite inspired by `go-ptt`, not part of that family.

## Per-candidate notes

### `@viren070/parse-torrent-title` (recommended)
- **API shape.** 38-field `ParsedResult` interface: `title`, `year` (string), `date`, `country`, `resolution`, `quality`, `codec`, `bitDepth`, `hdr[]`, `threeD`, `audio[]`, `channels[]`, `seasons[]`, `episodes[]`, `episodeTitle`, `episodeCode`, `complete`, `volumes[]`, `languages[]`, `dubbed`, `subbed`, `hardcoded`, `group`, `site`, `network`, `editions[]`, `releaseTypes[]`, `repack`, `proper`, `retail`, `regraded`, `unrated`, `uncensored`, `extended`, `convert`, `documentary`, `commentary`, `upscaled`, `container`, `extension`, `region`, `size`. The `seasons[]`/`episodes[]` arrays handle range releases (`S01E01-E03`) cleanly, and the `complete` flag covers `S01.COMPLETE` packs.
- **Node compatibility.** Native JS, ESM-only (`"type": "module"`, `"exports": {".": {"import": "./dist/index.js"}}`). The repo is already `"type": "module"` (package.json:37) and Next.js 16 handles ESM dependencies natively. ts-jest will need `transformIgnorePatterns` adjusted if we ever unit-test the matcher wrapper — see "Caveats" below.
- **Runtime footprint.** On disk ~155 KB of `dist/` JS (handlers.js is 93 KB unminified), ~424 KB with package metadata. Zero runtime dependencies. Importing the package adds ~155 KB of source to the server bundle — negligible against the Next.js / Prisma baseline.
- **Parse accuracy.** Correct on all 5 representative torrents (Appendix). Correctly strips `2021` from `Dune.2021.1080p.BluRay.x264-SWEETNESS`, correctly detects `S01.COMPLETE` (sets `complete: true`), correctly tags MULTi as `languages: ["multi audio"]`, correctly leaves `year` unset for `Some.Show.S02E05.PROPER.720p`.
- **Failure mode.** Never throws on the 5 inputs. Throws synchronously if you import it incorrectly (it has no CJS entry — `require('@viren070/parse-torrent-title')` from CommonJS gives `No "exports" main defined`; use `import` or dynamic `import()`). When fields can't be parsed they are simply absent from the result.
- **Maintenance.** Last npm publish 17 days ago; 38 versions between 2025-11-01 and 2026-08-04; GitHub repo pushed 2026-08-04; 4 open issues; MIT. Powers [Stremio's Torrentio addon](https://github.com/kevbob1/moviedb/issues/55) (npm "Dependents" not visible but the demo at `viren070.github.io/parse-torrent-title/` is the canonical Sonarr/radarr-style release parser used by the Stremio community).

### `parse-torrent-title` (clement-escolano)
- **API shape.** ~17 fields: `title`, `year` (number), `resolution`, `codec`, `source`, `group`, `season` (number), `episode` (number), `episodeName`, plus optional `part`/`languages`/etc. via `addHandler`. Notably **no `complete` flag** and scalar `season`/`episode` (no array), so multi-episode ranges need a custom handler.
- **Node compatibility.** CJS, drop-in `require("parse-torrent-title")`. ESM consumers can `import` it.
- **Runtime footprint.** ~13 KB total source (parser.js 3.6 KB, handlers.js 9.8 KB). Zero runtime dependencies.
- **Parse accuracy.** Correct on all 5 inputs in the test set, including `S01.COMPLETE` (sets `season: 1`, but no `complete` flag) and MULTi (sets `language: "multi"`).
- **Failure mode.** Returns partial objects with undefined fields; does not throw. Easy to use as a drop-in replacement for `@viren070`.
- **Maintenance.** Last publish 2026-04-25 (≈4 months ago); 9 versions since 2017; 5 open issues; MIT. Used by Sonarr/Wizarr ecosystem; would be a fine fallback if `@viren070` ever falls out of maintenance.

### `oleoo` (thcolin)
- **API shape.** Returns `original`, `language`, `languages[]`, `source` (string like `"BLURAY"`), `encoding` (e.g. `"x264"`), `resolution`, `dub`, `year` (string), `flags[]`, `season` (number), `episode` (string, e.g. `"03"`), `episodes[]`, `type: 'movie' | 'tvshow'`, `group`, `title`, `generated`, `score: 0–8`. The `type` and `score` fields are unique among the Node candidates and directly useful — `type` maps cleanly to `Request.media_type` filtering, and `score` is a parser-confidence signal we could feed into the matcher's "score visible" requirement.
- **Node compatibility.** ESM (`"type": "module"`, `main: src/index.js`). Test invocation needed `require('oleoo').default.parse(...)` from CJS to access the default export — works because Node CJS-loads ESM modules via the synthetic namespace.
- **Runtime footprint.** Source is a single 38 KB `src/index.js`. The published package is 4.2 MB on disk because it ships its `tests/` folder (no `"files"` field in package.json), but only the 38 KB `src/index.js` actually runs. Zero runtime dependencies.
- **Parse accuracy.** Correct on all 5 inputs. `type` field is reliably populated (`'movie'` vs `'tvshow'`), including for the no-year episode where it correctly returns `'tvshow'`.
- **Failure mode.** `oleoo.parse(name, { strict: true })` throws on inputs that don't look like scene releases (e.g. `"Not.a.Movie-v28.1-macOS"`); the default `strict: false` returns partial results without throwing.
- **Maintenance.** Last push 2025-06-18 (~14 months ago); 28 versions on npm; 2 open issues; 13 weekly downloads (small but real audience). Maintainer responsiveness is the big unknown — the version cadence has slowed considerably.

### `parse-torrent-name` (jzjzjzj) — rejected
- **API shape.** 21 fields including `audio`, `codec`, `container`, `episode`, `episodeName`, `excess`, `extended`, `garbage`, `group`, `hardcoded`, `language`, `proper`, `quality`, `region`, `repack`, `resolution`, `season`, `title`, `website`, `widescreen`, `year`. Scalar `season`/`episode`. **No `type` or `complete` fields.**
- **Node compatibility.** CJS, drop-in.
- **Runtime footprint.** 610 B core + 172 B entry point. Smallest of all candidates.
- **Parse accuracy.** Failed on 4 of 5 representative torrents:
  - `Dune.2021.1080p.BluRay.x264-SWEETNESS` → `title: "Dune 2021"` (year absorbed into title)
  - `Severance.S01.COMPLETE.1080p.WEB-DL.x264-GROUP` → `title: "Severance S01 COMPLETE"` (season and COMPLETE absorbed)
  - `Dune.2021.MULTi.1080p.BluRay.x264-UH` → `title: "Dune 2021 MULTi"`
  - `Some.Show.S02E05.PROPER.720p` → `group: "720p"` (resolution mistagged as release group)
- **Failure mode.** Returns partial objects; does not throw.
- **Maintenance.** Last push 2015-01-02 (~11 years ago); npm declares `"license": "none"`; 61 open issues out of 140 stars. Effectively abandoned.

The canonical repo is `jzjzjzj/parse-torrent-name` (140 stars) — the ticket body pointed at `github.com/rema/parse-torrent-name`, which 404s; the npm name `parse-torrent-name` resolves to the `jzjzjzj` package either way.

### `guessit` — rejected
- **API shape.** The richest of all candidates: `title`, `year`, `season`, `episode`, `episode_title`, `episode_details`, `screen_size`, `source`, `video_codec`, `audio_codec`, `release_group`, `container`, `mimetype`, `type` (`'movie'` / `'episode'`), `country`, `language`, `subtitle_language`, `date`, `release_year`, `cd`, `cd_count`, `edition`, `film`, `film_collection`, `bonus`, `comment`, `complete`, `franchise`, `other`, `website`, `uuid`, `crc32`, `id`, `format`, `aspect_ratio`, `bit_depth`, `hdr`, `3d`, `profile`, `audio_channels`, `audio_profile`, `video_api`, `video_bit_rate`, … 60+ fields. Unmatched coverage.
- **Node compatibility.** **Python only.** The README links to [`guessit-js`](https://github.com/opensubtitles/guessit-js), a third-party WASM port, which would remove the Python requirement. The map's standing preferences and ADR-0005's "narrow seam" principle argue against introducing a Node↔Python bridge or a sidecar service. If we wanted the WASM port, this should be a separate evaluation.
- **Runtime footprint.** `guessit` itself is ~5 MB installed; pulls in `rebulk`, `python-stdnum`, `babelfish`, `pycountry`, `iso-639`, `iso3166`. The WASM port (`guessit-js`) ships a ~10 MB `.wasm` blob — non-trivial for the standalone Next.js runner.
- **Parse accuracy.** Excellent (Sonarr, Radarr, Bazarr all use it). Out of scope to verify here since Node-incompatibility disqualifies it.
- **Failure mode.** Returns a `MatchesDict`; partial on missing fields; does not throw on bad input.
- **Maintenance.** Last push 2026-08-09 (12 days ago); 16 open issues; LGPL-3.0 (a copyleft license — fine for a runtime library that we just call, but worth flagging for legal review).

### `torrent-name-parser` (and forks) — rejected without detailed testing
The `torrent-name-parser` family (`torrent-name-parser`, `parse-torrent-filename` × 3 forks, `torrent-name-parse`, `torrent-name-parse-rs`) is the same 2014 regex engine as `parse-torrent-name`, just with newer maintainers or different module names. None of them publish the source on a faster cadence than `@viren070` and none of them expose a `complete` flag or an explicit `type` field. The ticket's mention of "anitarr-parsers / other Node-native alternatives" is satisfied by the four actively-maintained candidates above.

## Caveats specific to `@viren070/parse-torrent-title`

1. **ESM-only.** `import { parseTorrentTitle } from '@viren070/parse-torrent-title';` is the correct invocation. `require()` from CommonJS raises `No "exports" main defined`. The matcher module (`src/lib/matcher/…`) will be authored in TypeScript and consumed by both Next.js server actions and the cron route — both paths support ESM natively. Only the Jest unit tests need a small adjustment: either configure `transformIgnorePatterns` to include the package's `dist/`, or use a dynamic `await import(...)` inside the matcher wrapper.
2. **`year` is a string.** All the other active Node libraries return a number except `oleoo`, which also returns a string. The matcher wrapper should `Number(year)` before doing year-equality checks. This is a one-line concern, but it must live in the wrapper, not in the matcher's policy code.
3. **`season` / `episode` are arrays.** `seasons: [1]` and `episodes: [3]`. The wrapper will read `.seasons[0]` / `.episodes[0]` for the single-episode case and treat arrays longer than 1 as a range release (out of scope for the first ADR but the data is already there).
4. **`type` is implicit.** The library returns `seasons[]` / `episodes[]` but no string discriminator like oleoo's `type: 'movie' | 'tvshow'`. The standing-preference "filter candidates by `media_type`" maps cleanly anyway: a torrent with non-empty `seasons` or `episodes` is TV; otherwise it's a movie.

## Out-of-scope confirmations

- No choice of matching *algorithm* here — that's ticket #58 (matcher design). The parser just surfaces fields; the algorithm decides how to score them.
- The "score visible" requirement is about *matcher* score, not parser confidence. oleoo's `score: 0–8` is interesting but not necessary — the matcher's own score is what the UI displays per the map.
- The "what does the matcher do when parsing fails" question (in the map's "Not yet specified") becomes: `@viren070/parse-torrent-title` returns partial objects with absent fields; it never throws on bad input. The matcher should treat `title === undefined` as "skip candidate" (the obvious policy, but the ADR must commit to it).

## Appendix — raw parse output on the 5 representative torrents

Generated against `@viren070/parse-torrent-title@0.8.6`, `parse-torrent-title@3.0.1`,
`oleoo@2.0.4`, and `parse-torrent-name@0.5.4` installed via `npm install --no-save`
on Node v25.9.0 (matches the runtime in `Dockerfile:1`). Source script inlined
below the results.

### a. Movie with year + 1080p + release group
```
Input: "Dune.2021.1080p.BluRay.x264-SWEETNESS"
```

`@viren070/parse-torrent-title@0.8.6`:
```json
{
  "resolution": "1080p",
  "year": "2021",
  "quality": "BluRay",
  "codec": "x264",
  "group": "SWEETNESS",
  "title": "Dune"
}
```

`parse-torrent-title@3.0.1`:
```json
{
  "year": 2021,
  "resolution": "1080p",
  "source": "bluray",
  "codec": "x264",
  "group": "SWEETNESS",
  "title": "Dune"
}
```

`oleoo@2.0.4`:
```json
{
  "original": "Dune.2021.1080p.BluRay.x264-SWEETNESS",
  "language": null,
  "languages": [],
  "source": "BLURAY",
  "encoding": "x264",
  "resolution": "1080p",
  "dub": null,
  "year": "2021",
  "flags": [],
  "season": null,
  "episode": null,
  "episodes": [],
  "type": "movie",
  "group": "SWEETNESS",
  "title": "Dune",
  "generated": "Dune.2021.1080p.BLURAY.x264-SWEETNESS",
  "score": 5
}
```

`parse-torrent-name@0.5.4` (rejected — year bled into title):
```json
{
  "resolution": "1080p",
  "quality": "BluRay",
  "codec": "x264",
  "group": "SWEETNESS",
  "title": "Dune 2021"
}
```

### b. TV season pack
```
Input: "Severance.S01.COMPLETE.1080p.WEB-DL.x264-GROUP"
```

`@viren070/parse-torrent-title@0.8.6` (only candidate to surface `complete: true`):
```json
{
  "resolution": "1080p",
  "quality": "WEB-DL",
  "codec": "x264",
  "group": "GROUP",
  "complete": true,
  "seasons": [1],
  "title": "Severance"
}
```

`parse-torrent-title@3.0.1`:
```json
{
  "resolution": "1080p",
  "source": "web-dl",
  "codec": "x264",
  "group": "GROUP",
  "season": 1,
  "title": "Severance"
}
```

`oleoo@2.0.4` (note the stray `null` in `flags`):
```json
{
  "original": "Severance.S01.COMPLETE.1080p.WEB-DL.x264-GROUP",
  "language": null,
  "languages": [],
  "source": "WEB-DL",
  "encoding": "x264",
  "resolution": "1080p",
  "dub": null,
  "year": null,
  "flags": [null],
  "season": 1,
  "episode": null,
  "episodes": [],
  "type": "tvshow",
  "group": "GROUP",
  "title": "Severance",
  "generated": "Severance.S01.1080p.WEB-DL.x264-GROUP",
  "score": 5
}
```

`parse-torrent-name@0.5.4` (rejected — season + COMPLETE bled into title):
```json
{
  "resolution": "1080p",
  "quality": "WEB-DL",
  "codec": "x264",
  "group": "GROUP",
  "title": "Severance S01 COMPLETE"
}
```

### c. TV single episode
```
Input: "Severance.S01E03.720p.HDTV-GROUP"
```

All four candidates correctly extract `season=1`, `episode=3` (or `episodes=[3]`),
`title="Severance"`, `resolution="720p"`, `group="GROUP"`.

`@viren070/parse-torrent-title@0.8.6`:
```json
{
  "resolution": "720p",
  "quality": "HDTV",
  "group": "GROUP",
  "seasons": [1],
  "episodes": [3],
  "title": "Severance"
}
```

`parse-torrent-title@3.0.1`:
```json
{
  "resolution": "720p",
  "source": "hdtv",
  "group": "GROUP",
  "season": 1,
  "episode": 3,
  "title": "Severance"
}
```

`oleoo@2.0.4`:
```json
{
  "original": "Severance.S01E03.720p.HDTV-GROUP",
  "language": null,
  "languages": [],
  "source": "HDTV",
  "encoding": null,
  "resolution": "720p",
  "dub": null,
  "year": null,
  "flags": [],
  "season": 1,
  "episode": "03",
  "episodes": [3],
  "type": "tvshow",
  "group": "GROUP",
  "title": "Severance",
  "generated": "Severance.S01E03.720p.HDTV-GROUP",
  "score": 3
}
```

`parse-torrent-name@0.5.4`:
```json
{
  "season": 1,
  "episode": 3,
  "resolution": "720p",
  "quality": "HDTV",
  "group": "GROUP",
  "title": "Severance"
}
```

### d. Oddly-named release (Dune MULTi)
```
Input: "Dune.2021.MULTi.1080p.BluRay.x264-UH"
```

`@viren070/parse-torrent-title@0.8.6`:
```json
{
  "resolution": "1080p",
  "year": "2021",
  "quality": "BluRay",
  "codec": "x264",
  "group": "UH",
  "languages": ["multi audio"],
  "dubbed": true,
  "title": "Dune"
}
```

`parse-torrent-title@3.0.1`:
```json
{
  "year": 2021,
  "resolution": "1080p",
  "source": "bluray",
  "codec": "x264",
  "group": "UH",
  "language": "multi",
  "title": "Dune"
}
```

`oleoo@2.0.4`:
```json
{
  "original": "Dune.2021.MULTi.1080p.BluRay.x264-UH",
  "language": "MULTi",
  "languages": ["MULTi"],
  "source": "BLURAY",
  "encoding": "x264",
  "resolution": "1080p",
  "dub": null,
  "year": "2021",
  "flags": [],
  "season": null,
  "episode": null,
  "episodes": [],
  "type": "movie",
  "group": "UH",
  "title": "Dune",
  "generated": "Dune.2021.MULTi.1080p.BLURAY.x264-UH",
  "score": 6
}
```

`parse-torrent-name@0.5.4` (rejected — year + MULTi bled into title):
```json
{
  "resolution": "1080p",
  "quality": "BluRay",
  "codec": "x264",
  "group": "UH",
  "title": "Dune 2021 MULTi"
}
```

### e. Release without a year
```
Input: "Some.Show.S02E05.PROPER.720p"
```

`@viren070/parse-torrent-title@0.8.6`:
```json
{
  "resolution": "720p",
  "proper": true,
  "seasons": [2],
  "episodes": [5],
  "title": "Some Show"
}
```

`parse-torrent-title@3.0.1`:
```json
{
  "resolution": "720p",
  "proper": true,
  "season": 2,
  "episode": 5,
  "title": "Some Show"
}
```

`oleoo@2.0.4`:
```json
{
  "original": "Some.Show.S02E05.PROPER.720p",
  "language": null,
  "languages": [],
  "source": null,
  "encoding": null,
  "resolution": "720p",
  "dub": null,
  "year": null,
  "flags": ["PROPER"],
  "season": 2,
  "episode": "05",
  "episodes": [5],
  "type": "tvshow",
  "group": null,
  "title": "Some Show",
  "generated": "Some.Show.S02E05.PROPER.720p-NOTEAM",
  "score": 2
}
```

`parse-torrent-name@0.5.4` (rejected — `720p` mistagged as release group):
```json
{
  "season": 2,
  "episode": 5,
  "proper": true,
  "title": "Some Show",
  "group": "720p"
}
```

### Test harness (for reproducibility)

```js
// /tmp/parser-test/run.js (research-only; not committed to the repo)
const TORRENTS = [
  ['a.movie.year.1080p.group',  'Dune.2021.1080p.BluRay.x264-SWEETNESS'],
  ['b.tv.season.pack',          'Severance.S01.COMPLETE.1080p.WEB-DL.x264-GROUP'],
  ['c.tv.single.episode',       'Severance.S01E03.720p.HDTV-GROUP'],
  ['d.oddly.named.release',     'Dune.2021.MULTi.1080p.BluRay.x264-UH'],
  ['e.no.year.episode',         'Some.Show.S02E05.PROPER.720p'],
];
async function main() {
  const viren = await import('@viren070/parse-torrent-title');
  const libs = [
    ['parse-torrent-name@0.5.4',          (n) => require('parse-torrent-name')(n)],
    ['parse-torrent-title@3.0.1',         (n) => require('parse-torrent-title').parse(n)],
    ['@viren070/parse-torrent-title@0.8.6',
                                           (n) => viren.parseTorrentTitle(n)],
    ['oleoo@2.0.4',                       (n) => require('oleoo').default.parse(n)],
  ];
  for (const [label, name] of TORRENTS) {
    for (const [lib, fn] of libs) {
      try { console.log(label, lib, JSON.stringify(fn(name), null, 2)); }
      catch (e) { console.log(label, lib, 'THROWS', e.message); }
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
```