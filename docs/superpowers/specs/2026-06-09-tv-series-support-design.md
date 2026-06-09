# TV Series Support — Design

## Summary

Extend MovieDB to support requesting TV series (seasons). A request is always per-season — requesting a show fans out to N per-season requests, one for each season that doesn't already exist. Movies remain unchanged.

## Schema Changes

- Drop `@unique` on `tmdb_id` (prevents same TMDB ID with different season numbers)
- Add `season_number Int?` — null for movies, required integer for TV seasons
- Duplicate detection moves to service layer: `findFirst({ where: { tmdb_id, season_number } })`

```prisma
model Request {
  id            Int       @id @default(autoincrement())
  title         String
  tmdb_id       Int?
  season_number Int?
  poster_path   String?
  release_date  String?
  overview      String?
  genre_ids     Int[]     @default([])
  requested_at  DateTime  @default(now())
  requested_by  String
  status        String    @default("pending")
  media_type    String    @default("movie")

  @@map("requests")
}
```

## TMDB Client (`src/lib/tmdb.ts`)

Add TV types and search:

```ts
export interface TMDBSeries {
  id: number;
  name: string;
  overview?: string;
  first_air_date?: string;
  poster_path?: string;
  vote_average?: number;
  genre_ids?: number[];
}

export interface TMDBSeason {
  season_number: number;
  name: string;
  episode_count: number;
  poster_path?: string;
}

export async function searchTMDBTV(query: string): Promise<TMDBSeries[]>;
export async function getTMDBTVDetails(tmdbId: number): Promise<{ seasons: TMDBSeason[] }>;
```

## API Routes

### `/api/tmdb/search`

Accepts `?type=movie|tv` (default: `movie`). Calls `searchTMDBMovies` or `searchTMDBTV` accordingly.

### `/api/jellyfin/check`

Extended to query `IncludeItemTypes=Movie,Series,Season`. A secondary cache maps `tmdb_show_id → Set<season_number>`. Response gains a `seasons` field:

```ts
{
  results: Record<number, boolean>,       // unchanged: movie or whole-show boolean
  seasons: Record<number, number[]>,      // NEW: tmdb_show_id → available season numbers
  error?: string,
  configured: boolean
}
```

Cache TTL remains 5 minutes. Both movie IDs and season data invalidate together.

## Service Layer (`src/lib/request-service.ts`)

### `CreateRequestInput` extended

```ts
export interface CreateRequestInput {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  requestedBy: string;
  releaseDate?: string;
  overview?: string;
  genreIds?: number[];
  mediaType: string;       // "movie" | "tv"
  seasonNumber?: number;   // null for movies, required for TV
}
```

### Fan-out for full-show requests

New function `createTvRequests(tmdbId, requestedBy)`: fetches seasons from `getTMDBTVDetails()`, loops through all seasons calling `createRequest()` for each, skipping duplicates. Season 0 (Specials) is excluded. Returns array of created/skipped requests.

### Duplicate check

Changed from `findUnique({ where: { tmdb_id } })` to `findFirst({ where: { tmdb_id, season_number } })`.

### Notifications

`sendRequestNotification` includes season number in metadata. For full-show fan-out, a single email lists all seasons requested, not N separate emails.

## Server Actions (`src/app/actions/request-actions.ts`)

- `createRequest(...)` — signature gains `mediaType` and `seasonNumber` params
- New `createTvShowRequests(tmdbId, title, posterPath, requestedBy, releaseDate, overview, genreIds)` — fan-out action

## UI: Search Page (`src/app/page.tsx`)

### Tabs

A "Movies" / "TV Shows" toggle above the search input. Controls:
- TMDB endpoint (`?type=movie|tv`)
- Placeholder text
- Result rendering (title vs name, release_date vs first_air_date, TMDB link `/movie/` vs `/tv/`)

### TV search results

Each card shows: show name, first air year, genres, overview.

**Seasons row:** Each season displayed with its Jellyfin availability:
- Already on Jellyfin: green badge, no request button
- Not on Jellyfin: "Request" button
- "Request All Missing Seasons" button (requests only seasons not already present)

The `RequestForm` component is unchanged — still collects requester name. Season context is determined by which button the user clicked.

## UI: Requests Page (`src/app/requests/page.tsx`)

Each `RequestListItem` card gains:
- Media type badge: "TV" or "Movie" next to the status badge
- Season info: "Season {N}" appended to title for TV requests
- TMDB link: `/tv/{id}` for TV shows, `/movie/{id}` for movies

No layout changes. FSM actions unchanged. Existing filters unchanged.

## Duplicate Detection Summary

| Media type | season_number | Uniqueness |
|---|---|---|
| movie | NULL | Unique per `tmdb_id` |
| tv | 3 | Unique per `(tmdb_id, 3)` |

Full-show requests don't exist as records — they always fan out to per-season records.
