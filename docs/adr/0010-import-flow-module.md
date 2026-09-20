# ADR-0010: Import Flow Module — One Module for Search → Availability → Request

## Status

Accepted (2026-09-19).

## Context

The import flow — operator searches TMDB, sees Jellyfin availability, requests titles — was a client god-module:

- `src/app/page.tsx` (422 lines, all `'use client'`) owned 13 state variables, a `handleSearch` that fetched `/api/tmdb/search` → `/api/jellyfin/check` (`Promise.all` with `/api/tmdb/tv/seasons` for TV), three near-identical request handlers (`handleMovieRequest`, `handleSeasonRequest`, `handleRequestAllSeasons` — ~15 lines each whose only real difference is the server action called), error-string extraction (`data.details`, `err instanceof Error ? err.message : String(err)` repeated in all four handlers), and a join-by-key merge of `jellyfinResults` / `jellyfinSeasons` / `tmdbSeasons` maps onto render.
- `requestFromResult`-shaped logic was triplicated: the only real step that varied between the three handlers was the service call (`createRequest` vs `createTvRequests`).

Friction:

1. The interface of the import flow was three HTTP responses and a join algebra — as complex as the implementation. Understanding "search → availability → request" required bouncing across 6+ files.
2. Zero tests reached the orchestration: `page.tsx` had no test file; the three route tests only covered the route shells.
3. Error modes leaked as strings (route `details`, thrown keys, per-caller re-mapping).

Related fact: `request-lifecycle/repository.ts` also imports `getTMDBTVDetails` from `src/lib/tmdb.ts`, so a TMDB client factory would have two consumers from day one — a real seam by the two-adapter rule.

## Decision

Collapse the import flow into one module, `src/lib/import-flow/`, with the read side served by one route and the mutation side by one server action, both staying thin.

### Module layout

```
src/lib/import-flow/
  index.ts        — createImportFlow({ tmdb, jellyfin, requestService }) + default singleton
  search.ts       — fan-in: TMDB search + Jellyfin availability (+ seasons lazily via seasonsFor(id))
  availability.ts — AvailabilityResult / SeasonView projection, missing-season derivation
  __tests__/      — service/search/availability tests
```

### Interface

```ts
createImportFlow({
  tmdb: TmdbClient,
  jellyfin: { availabilityFor, seasonsForMany },
  requestService: Pick<RequestService, 'createRequest' | 'createTvRequests'>,
})

search(query: string, type: 'movie' | 'tv'): Promise<SearchResult>
// SearchResult = { items: ImportResult[],
//                  availability: { configured: boolean, error: string | null } }

seasonsFor(id: number): Promise<Season[] | null>   // lazy TMDB tvDetails, kept lazy per round-1 Q5
```

`ImportResult` embeds availability on the result — `onJellyfin: boolean`, `availableSeasons: number[]`, regular-season filtering and `missingSeasons` derivation happen inside the module (the join-by-key maps and the regular-season filter currently in `TvResultCard` move behind the interface). No side-maps cross the seam.

Error modes are part of the interface: TMDB failure throws `TmdbError` (fatal to the search); Jellyfin catalog failure degrades softly — `availability.error` carries the message, `items` still render with `onJellyfin: false` and no seasons. Nothing is expressed as thrown strings.

### Mutation

One verb, replacing the triplicated handlers:

```ts
requestImport(result: ImportResult, seasonNumber: number | 'all', requestedBy: string): Promise<ImportResult>
```

It calls the `request-lifecycle` service (`createRequest` / `createTvRequests`), then re-projects the affected result's availability and returns the refreshed `ImportResult` — the page merges it by identity, not by key algebra. The verb lives in `src/lib/import-flow/`; the `'use server'` adapter in `request-actions.ts` stays the only thing the client imports for mutation.

`revalidatePath` stays at the RPC-boundary (server-action) layer, applied uniformly — this fixes the existing inconsistency where the movie path revalidated nothing while `createTvShowRequests` revalidated `/requests`.

### TMDB client (prerequisite, from architecture-review candidate #5)

`src/lib/tmdb.ts` becomes `createTmdbClient({ apiKey, fetch }) → { searchMovies, searchTV, tvDetails }` with a typed `TmdbError`, and two adapters: `HttpTmdbAdapter` (production) and `InMemoryTmdbAdapter` (tests). Two consumers wire to it: `import-flow` and `request-lifecycle/repository.ts`. The key-missing and non-ok conditions throw `TmdbError` instead of strings.

### Wire shape

- Read: `GET /api/import/search?q=&type=` — thin adapter over `defaultImportFlow.search()`; wrapped by `withLogging`. Replaces `/api/tmdb/search`, `/api/tmdb/tv/seasons`, `/api/jellyfin/check` (deleted; `page.tsx` was their only caller — verified).
- Mutation: `requestImport(result, seasonNumber | 'all', requestedBy)` via `request-actions.ts`.

### Page after deepening

`page.tsx` keeps render state only: `query`, `searchType`, `loading`, `results: ImportResult[]`, `error`, availability-degrade banner state, per-card `requesting` keys, and the in-file movie/TV result cards. It loses all fan-in, joins, handler bodies, and error-string algebra. `RequestForm`'s contract is unchanged (`onSubmit(requestedBy)`).

## Considered Options

- **Client-side lib module keeping the three routes.** Rejected: concentrates the orchestration but the seam still spans the wire with three caller-facing verbs; the join algebra stays caller-visible.
- **Side-maps in the search return** (shape-preserving). Rejected: the join-by-key algebra is the complexity worth absorbing; the route would have converted one leak into another.
- **Everything throws.** Rejected: a stale/degraded Jellyfin catalog is display-cosmetic per ADR-0005's posture; surfacing it as an error over a failed search would make the whole flow hostage to one soft dependency.
- **Eager TMDB seasons in `search()`.** Deferred: pays TMDB latency for results the operator may not open; `seasonsFor(id)` keeps the interface small and eager can be collapsed inside the module later without changing callers.
- **`revalidatePath` inside the deep module.** Rejected: the module stays domain-shaped; the server action is the Next.js RPC boundary and owns Next.js policy (ADR-0007 pattern).
- **Postpone TMDB client, stub `fetch` in import-flow tests.** Rejected: `repository.ts`'s existing `getTMDBTVDetails` import makes the seam real (two adapters); deferring re-opens the same files twice and leaves flow tests re-stubbing `global.fetch`.

## Consequences

- `src/app/page.tsx` shrinks to render state + presentational concerns; its fan-in, three handler bodies, and error-extraction shells are deleted.
- Three routes collapse to one: `/api/tmdb/search`, `/api/tmdb/tv/seasons`, `/api/jellyfin/check` deleted with their route tests; one `withCron`-style logging-wrapped read route remains (their tests' auth/validation cases reduce to one route test).
- `src/lib/tmdb.ts` gains the adapter seam its siblings (Jellyfin, Transmission) already have; `request-lifecycle/repository.ts` migrates to the client.
- `request-actions.ts` gains `requestImport` and drops dead end-points; `revalidatePath` policy becomes uniform.
- New test surface: `import-flow` module tests (search fan-in, soft-degrade posture, availability embedding, `requestImport` projection round-trip) replace zero existing orchestration tests; `TmdbError` cases test once, not per-caller.
- CONTEXT.md gains the **Import flow** term.

## Pointer

- `src/lib/import-flow/` — the module.
- `src/lib/tmdb.ts` → `createTmdbClient` + `TmdbError` + Http/InMemory adapters.
- `src/app/api/import/search/route.ts` — read route; `src/actions/request-actions.ts` (or equivalent path) — `requestImport` server action.
- `src/lib/request-lifecycle/repository.ts` — migrates `getTMDBTVDetails` to the client factory.
- `src/app/page.tsx` — the deepened page.
