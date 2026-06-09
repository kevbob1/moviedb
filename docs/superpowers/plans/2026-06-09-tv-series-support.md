# TV Series Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TV series request support where each request targets one season, with fan-out for full-show requests and per-season Jellyfin availability display.

**Architecture:** Extend the existing `Request` model with `season_number`, add TV search/types to the TMDB client, extend Jellyfin to scan and cache season data, and update the search UI with media type tabs and season-level availability display. All three tiers (DB, API, UI) get incremental changes following existing patterns.

**Tech Stack:** Next.js 14 App Router, Prisma + PostgreSQL, Jest + React Testing Library, Tailwind v4

---

### Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_season_number/` (generated)

- [ ] **Step 1: Update schema**

Replace the `Request` model in `prisma/schema.prisma`:

```prisma
model Request {
  id            Int      @id @default(autoincrement())
  title         String
  tmdb_id       Int?
  season_number Int?
  poster_path   String?
  release_date  String?
  overview      String?
  genre_ids     Int[]    @default([])
  requested_at  DateTime @default(now())
  requested_by  String
  status        String   @default("pending")
  media_type    String   @default("movie")

  @@map("requests")
}
```

- [ ] **Step 2: Generate migration**

Run: `npm run db:migrate:dev`
Expected: Prisma creates a migration SQL file dropping the unique index on `tmdb_id` and adding `season_number`. Review the generated SQL to confirm it only drops the index (not the column) and adds the nullable column.

- [ ] **Step 3: Regenerate Prisma client**

Run: `npm run db:generate-client`
Expected: Client regenerated successfully with new `season_number` field.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/prisma/
git commit -m "feat: add season_number to request, drop tmdb_id unique constraint"
```

---

### Task 2: TMDB Client — TV Types, Search, and Details

**Files:**
- Modify: `src/lib/tmdb.ts`
- Create: `src/lib/__tests__/tmdb.test.ts` (extend)

- [ ] **Step 1: Write failing tests for TV search and details**

Add to `src/lib/__tests__/tmdb.test.ts`:

```ts
import { searchTMDBMovies, searchTMDBTV, getTMDBTVDetails } from '../tmdb';

// Add inside the existing describe block, after the searchTMDBMovies describe:

describe('searchTMDBTV', () => {
  it('returns shows on successful search', async () => {
    const mockShows = [
      { id: 100, name: 'Show 1', overview: 'Test 1', first_air_date: '2020-01-01' },
      { id: 200, name: 'Show 2', overview: 'Test 2', first_air_date: '2021-06-15' },
    ];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: mockShows, page: 1, total_pages: 1, total_results: 2 }),
    });

    const results = await searchTMDBTV('test');
    expect(results).toEqual(mockShows);
  });

  it('throws on API error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });
    await expect(searchTMDBTV('test')).rejects.toThrow('TMDB API error: 401 Unauthorized');
  });
});

describe('getTMDBTVDetails', () => {
  it('returns seasons array', async () => {
    const mockDetails = {
      id: 100,
      name: 'Test Show',
      seasons: [
        { season_number: 1, name: 'Season 1', episode_count: 10, poster_path: '/s1.jpg' },
        { season_number: 2, name: 'Season 2', episode_count: 8, poster_path: null },
        { season_number: 0, name: 'Specials', episode_count: 2, poster_path: null },
      ],
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDetails,
    });

    const result = await getTMDBTVDetails(100);
    expect(result.seasons).toHaveLength(3);
    expect(result.seasons[0].season_number).toBe(1);
    expect(result.seasons[1].season_number).toBe(2);
    expect(result.seasons[2].season_number).toBe(0);
  });

  it('throws on API error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
    await expect(getTMDBTVDetails(999)).rejects.toThrow('TMDB API error: 404 Not Found');
  });
});
```

Run: `npx jest src/lib/__tests__/tmdb.test.ts --testPathPattern="searchTMDBTV|getTMDBTVDetails" -t "searchTMDBTV|getTMDBTVDetails"`
Expected: FAIL — `searchTMDBTV is not a function`, `getTMDBTVDetails is not a function`

- [ ] **Step 2: Add TV types and functions to `src/lib/tmdb.ts`**

Add after the existing `TMDBMovie` interface and before `searchTMDBMovies`:

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

export interface TMDBSearchTVResponse {
  page: number;
  results: TMDBSeries[];
  total_pages: number;
  total_results: number;
}

export interface TMDBTVDetailsResponse {
  id: number;
  name: string;
  seasons: TMDBSeason[];
}
```

Add after `searchTMDBMovies`:

```ts
export async function searchTMDBTV(query: string): Promise<TMDBSeries[]> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not configured");
  }

  const response = await fetch(
    `${BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  const data: TMDBSearchTVResponse = await response.json();
  return data.results;
}

export async function getTMDBTVDetails(tmdbId: number): Promise<TMDBTVDetailsResponse> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB_API_KEY is not configured");
  }

  const response = await fetch(
    `${BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/lib/__tests__/tmdb.test.ts`
Expected: All tests PASS (existing + new)

- [ ] **Step 4: Commit**

```bash
git add src/lib/tmdb.ts src/lib/__tests__/tmdb.test.ts
git commit -m "feat: add TMDB TV search and details functions"
```

---

### Task 3: TMDB Search API — Accept `type` Parameter

**Files:**
- Modify: `src/app/api/tmdb/search/route.ts`
- Create: `src/app/api/tmdb/search/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/tmdb/search/__tests__/route.test.ts`:

```ts
import { GET } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/tmdb', () => ({
  searchTMDBMovies: jest.fn(),
  searchTMDBTV: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TMDB Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('searches movies when type is movie', async () => {
    const searchTMDBMovies = jest.requireMock('@/lib/tmdb').searchTMDBMovies;
    searchTMDBMovies.mockResolvedValue([{ id: 1, title: 'Movie' }]);

    const req = new NextRequest('http://localhost/api/tmdb/search?q=test&type=movie');
    const res = await GET(req);
    const data = await res.json();

    expect(searchTMDBMovies).toHaveBeenCalledWith('test');
    expect(data.results).toEqual([{ id: 1, title: 'Movie' }]);
  });

  it('searches tv when type is tv', async () => {
    const searchTMDBTV = jest.requireMock('@/lib/tmdb').searchTMDBTV;
    searchTMDBTV.mockResolvedValue([{ id: 100, name: 'Show' }]);

    const req = new NextRequest('http://localhost/api/tmdb/search?q=test&type=tv');
    const res = await GET(req);
    const data = await res.json();

    expect(searchTMDBTV).toHaveBeenCalledWith('test');
    expect(data.results).toEqual([{ id: 100, name: 'Show' }]);
  });

  it('defaults to movie when type is missing', async () => {
    const searchTMDBMovies = jest.requireMock('@/lib/tmdb').searchTMDBMovies;
    searchTMDBMovies.mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/tmdb/search?q=test');
    const res = await GET(req);
    const data = await res.json();

    expect(searchTMDBMovies).toHaveBeenCalledWith('test');
    expect(data.results).toEqual([]);
  });

  it('returns empty results when query is empty', async () => {
    const req = new NextRequest('http://localhost/api/tmdb/search?q=  ');
    const res = await GET(req);
    const data = await res.json();

    expect(data.results).toEqual([]);
  });
});
```

Run: `npx jest src/app/api/tmdb/search/__tests__/route.test.ts`
Expected: FAIL

- [ ] **Step 2: Update the route handler**

Replace the handler in `src/app/api/tmdb/search/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { searchTMDBMovies, searchTMDBTV } from '@/lib/tmdb';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

async function handler(request: Request | NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'movie';

  if (!query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = type === 'tv'
      ? await searchTMDBTV(query)
      : await searchTMDBMovies(query);
    return NextResponse.json({ results });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'TMDB search failed');
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler);
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/app/api/tmdb/search/__tests__/route.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/tmdb/search/route.ts src/app/api/tmdb/search/__tests__/route.test.ts
git commit -m "feat: add TV search support to TMDB search API"
```

---

### Task 4: TMDB TV Seasons Batch API

**Files:**
- Create: `src/app/api/tmdb/tv/seasons/route.ts`
- Create: `src/app/api/tmdb/tv/seasons/__tests__/route.test.ts`

This endpoint batches season detail lookups. The search page calls it after getting TV results to show season rows.

- [ ] **Step 1: Write failing tests**

Create `src/app/api/tmdb/tv/seasons/__tests__/route.test.ts`:

```ts
import { GET } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/tmdb', () => ({
  getTMDBTVDetails: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TMDB TV Seasons API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns seasons for multiple shows', async () => {
    const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
    getTMDBTVDetails.mockResolvedValueOnce({
      seasons: [
        { season_number: 1, name: 'Season 1', episode_count: 10 },
        { season_number: 2, name: 'Season 2', episode_count: 8 },
      ],
    });
    getTMDBTVDetails.mockResolvedValueOnce({
      seasons: [
        { season_number: 1, name: 'Season 1', episode_count: 22 },
      ],
    });

    const req = new NextRequest('http://localhost/api/tmdb/tv/seasons?ids=100,200');
    const res = await GET(req);
    const data = await res.json();

    expect(data.seasons).toEqual({
      100: [
        { season_number: 1, name: 'Season 1', episode_count: 10 },
        { season_number: 2, name: 'Season 2', episode_count: 8 },
      ],
      200: [
        { season_number: 1, name: 'Season 1', episode_count: 22 },
      ],
    });
  });

  it('returns error for invalid ids', async () => {
    const req = new NextRequest('http://localhost/api/tmdb/tv/seasons?ids=invalid');
    const res = await GET(req);
    const data = await res.json();

    expect(data.error).toBe('No valid TV show IDs provided');
    expect(res.status).toBe(400);
  });

  it('handles empty ids', async () => {
    const req = new NextRequest('http://localhost/api/tmdb/tv/seasons');
    const res = await GET(req);
    const data = await res.json();

    expect(data.error).toBe('No valid TV show IDs provided');
    expect(res.status).toBe(400);
  });

  it('handles individual show errors gracefully', async () => {
    const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
    getTMDBTVDetails.mockRejectedValueOnce(new Error('Not found'));
    getTMDBTVDetails.mockResolvedValueOnce({
      seasons: [{ season_number: 1, name: 'Season 1', episode_count: 10 }],
    });

    const req = new NextRequest('http://localhost/api/tmdb/tv/seasons?ids=999,100');
    const res = await GET(req);
    const data = await res.json();

    expect(data.seasons[999]).toEqual([]);
    expect(data.seasons[100]).toEqual([
      { season_number: 1, name: 'Season 1', episode_count: 10 },
    ]);
  });
});
```

Run: `npx jest src/app/api/tmdb/tv/seasons/__tests__/route.test.ts`
Expected: FAIL — route not found

- [ ] **Step 2: Create the route**

Create `src/app/api/tmdb/tv/seasons/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getTMDBTVDetails, TMDBSeason } from '@/lib/tmdb';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

async function handler(request: Request | NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids')?.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: 'No valid TV show IDs provided' }, { status: 400 });
  }

  try {
    const results = await Promise.all(
      ids.map(async (id): Promise<{ id: number; seasons: TMDBSeason[] }> => {
        try {
          const details = await getTMDBTVDetails(id);
          return { id, seasons: details.seasons };
        } catch (error) {
          logger.warn({ tmdbId: id, error: error instanceof Error ? error.message : 'Unknown' }, 'Failed to fetch TV details');
          return { id, seasons: [] };
        }
      })
    );

    const seasons: Record<number, TMDBSeason[]> = {};
    for (const result of results) {
      seasons[result.id] = result.seasons;
    }

    return NextResponse.json({ seasons });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'TV seasons fetch failed');
    return NextResponse.json(
      { error: 'Failed to fetch TV seasons', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler);
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/app/api/tmdb/tv/seasons/__tests__/route.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/tmdb/tv/seasons/
git commit -m "feat: add TMDB TV seasons batch API"
```

---

### Task 5: Jellyfin Client — Season Scanning

**Files:**
- Modify: `src/lib/jellyfin.ts`
- Modify: `src/lib/__tests__/jellyfin.test.ts`

- [ ] **Step 1: Add failing tests for season scanning**

Add to `src/lib/__tests__/jellyfin.test.ts`:

First, update the import at line 1 of `src/lib/__tests__/jellyfin.test.ts` to include `checkSeasonsOnJellyfin`:

```ts
import { isMovieOnJellyfin, areMoviesOnJellyfin, checkMovieOnJellyfin, checkMoviesOnJellyfin, checkSeasonsOnJellyfin, invalidateJellyfinCache, checkJellyfinConnectivity } from '../jellyfin';
```

Then add the following test block after the `caching` describe block, inside the main `describe('Jellyfin library', ...)`:

```ts
  describe('checkSeasonsOnJellyfin', () => {
    beforeEach(() => {
      invalidateJellyfinCache();
    });

    it('returns empty seasons when no IDs provided', async () => {
      const result = await checkSeasonsOnJellyfin([]);
      expect(result.seasons).toEqual({});
      expect(result.configured).toBe(false);
    });

    it('returns configured:false when JELLYFIN_URL is missing', async () => {
      delete process.env.JELLYFIN_URL;
      const result = await checkSeasonsOnJellyfin([100]);
      expect(result.configured).toBe(false);
    });

    it('returns season availability from Jellyfin', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Items: [
            { ProviderIds: { Tmdb: '100' }, IndexNumber: 1 },
            { ProviderIds: { Tmdb: '100' }, IndexNumber: 2 },
            { ProviderIds: { Tmdb: '200' }, IndexNumber: 1 },
          ],
          TotalRecordCount: 3,
        }),
      } as unknown as Response);

      const result = await checkSeasonsOnJellyfin([100, 200, 300]);
      expect(result.seasons).toEqual({
        100: [1, 2],
        200: [1],
        300: [],
      });
      expect(result.configured).toBe(true);
    });

    it('caches season results', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Items: [{ ProviderIds: { Tmdb: '100' }, IndexNumber: 1 }],
          TotalRecordCount: 1,
        }),
      } as unknown as Response);

      await checkSeasonsOnJellyfin([100]);
      await checkSeasonsOnJellyfin([100]);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
```

Run: `npx jest src/lib/__tests__/jellyfin.test.ts -t "checkSeasonsOnJellyfin"`
Expected: FAIL — `checkSeasonsOnJellyfin is not a function`

- [ ] **Step 2: Add season scanning to Jellyfin client**

Modify `src/lib/jellyfin.ts`:

Add new cache and types. Replace the caching section (lines 37-39) with:

```ts
let jellyfinTmdbCache: Set<string> | null = null;
let jellyfinSeasonCache: Map<string, Set<number>> | null = null;
let jellyfinCacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;
```

Add a new interface after `JellyfinCheckResult`:

```ts
export interface JellyfinSeasonCheckResult {
  seasons: Record<number, number[]>;
  error?: string;
  configured: boolean;
}
```

Add a new interface for Jellyfin season items:

```ts
interface JellyfinSeasonItem {
  ProviderIds?: { Tmdb?: string; [key: string]: string | undefined };
  IndexNumber?: number;
  [key: string]: unknown;
}
```

Modify `getJellyfinTmdbIds` to also fetch seasons. Replace the while loop inside `getJellyfinTmdbIds` to build both caches:

In `getJellyfinTmdbIds`, change line 60 to fetch both Movies and Seasons:

```ts
const endpoint = `/Items?IncludeItemTypes=Movie,Season&Recursive=true&Fields=ProviderIds,IndexNumber&Limit=${limit}&StartIndex=${startIndex}`;
```

Then update the item processing loop (lines 74-78) to also handle Season items:

```ts
for (const item of items) {
  const tmdbId = item.ProviderIds?.Tmdb;
  if (tmdbId) {
    tmdbIds.add(tmdbId);
    if (item.IndexNumber !== undefined) {
      if (!jellyfinSeasonCache) jellyfinSeasonCache = new Map();
      if (!jellyfinSeasonCache.has(tmdbId)) jellyfinSeasonCache.set(tmdbId, new Set());
      jellyfinSeasonCache.get(tmdbId)!.add(item.IndexNumber);
    }
  }
}
```

Also update the cache check and invalidation. In `getJellyfinTmdbIds`, update the cache check:

```ts
if (jellyfinTmdbCache && jellyfinSeasonCache && (now - jellyfinCacheTimestamp) < CACHE_TTL_MS) {
  return { ids: jellyfinTmdbCache };
}
```

Wait — the return type doesn't need to change. The season cache is built alongside the movie cache. We just need to check both caches exist and are valid.

In `invalidateJellyfinCache` (line 94-97), also clear the season cache:

```ts
export function invalidateJellyfinCache(): void {
  jellyfinTmdbCache = null;
  jellyfinSeasonCache = null;
  jellyfinCacheTimestamp = 0;
}
```

Add the `checkSeasonsOnJellyfin` function after `checkMoviesOnJellyfin`:

```ts
export async function checkSeasonsOnJellyfin(tmdbIds: number[]): Promise<JellyfinSeasonCheckResult> {
  if (!tmdbIds?.length) {
    return { seasons: {}, configured: false };
  }

  const { ids, error } = await getJellyfinTmdbIds();
  const configured = ids.size > 0 || !error;

  const seasons: Record<number, number[]> = {};
  for (const id of tmdbIds) {
    const key = String(id);
    const seasonSet = jellyfinSeasonCache?.get(key);
    seasons[id] = seasonSet ? Array.from(seasonSet).sort((a, b) => a - b) : [];
  }

  return { seasons, configured, error: !configured ? error : undefined };
}
```

Also update the `checkMovieOnJellyfin` and `isMovieOnJellyfin` functions to accept a `0` TMDB ID without error — currently they return `configured: false` for `tmdbId === 0`. This is fine, no change needed.

- [ ] **Step 3: Run tests**

Run: `npx jest src/lib/__tests__/jellyfin.test.ts`
Expected: All tests PASS (existing + new)

- [ ] **Step 4: Commit**

```bash
git add src/lib/jellyfin.ts src/lib/__tests__/jellyfin.test.ts
git commit -m "feat: add Jellyfin season scanning with cache"
```

---

### Task 6: Jellyfin Check API — Add Seasons Field

**Files:**
- Modify: `src/app/api/jellyfin/check/route.ts`
- Modify: `src/app/api/jellyfin/check/__tests__/route.test.ts` (create if not exists)

- [ ] **Step 1: Create or update tests**

Check if test file exists at `src/app/api/jellyfin/check/__tests__/route.test.ts`. If not, create it; if yes, add tests:

```ts
import { GET } from '../route';
import { NextRequest } from 'next/server';
import * as jellyfinModule from '@/lib/jellyfin';

jest.mock('@/lib/jellyfin', () => ({
  checkMoviesOnJellyfin: jest.fn(),
  checkMovieOnJellyfin: jest.fn(),
  checkSeasonsOnJellyfin: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Jellyfin Check API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns movies availability for movie IDs', async () => {
    const checkMoviesOnJellyfin = jest.requireMock('@/lib/jellyfin').checkMoviesOnJellyfin;
    checkMoviesOnJellyfin.mockResolvedValue({
      results: { 1: true, 2: false },
      configured: true,
    });

    const req = new NextRequest('http://localhost/api/jellyfin/check?ids=1,2');
    const res = await GET(req);
    const data = await res.json();

    expect(data.results).toEqual({ 1: true, 2: false });
    expect(data.configured).toBe(true);
  });

  it('includes seasons field in response', async () => {
    const checkMoviesOnJellyfin = jest.requireMock('@/lib/jellyfin').checkMoviesOnJellyfin;
    const checkSeasonsOnJellyfin = jest.requireMock('@/lib/jellyfin').checkSeasonsOnJellyfin;
    checkMoviesOnJellyfin.mockResolvedValue({
      results: { 1: false, 2: false },
      configured: true,
    });
    checkSeasonsOnJellyfin.mockResolvedValue({
      seasons: { 1: [1, 2], 2: [1] },
      configured: true,
    });

    const req = new NextRequest('http://localhost/api/jellyfin/check?ids=1,2');
    const res = await GET(req);
    const data = await res.json();

    expect(data.seasons).toEqual({ 1: [1, 2], 2: [1] });
  });
});
```

- [ ] **Step 2: Update the route handler**

Update `src/app/api/jellyfin/check/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { checkMoviesOnJellyfin, checkSeasonsOnJellyfin } from '@/lib/jellyfin';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

async function handler(request: Request | NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  const ids = searchParams.get('ids')?.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 });
  }

  try {
    const [moviesResult, seasonsResult] = await Promise.all([
      checkMoviesOnJellyfin(ids),
      checkSeasonsOnJellyfin(ids),
    ]);

    return NextResponse.json({
      results: moviesResult.results,
      seasons: seasonsResult.seasons,
      configured: moviesResult.configured || seasonsResult.configured,
      error: moviesResult.error || seasonsResult.error,
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Jellyfin check failed');
    return NextResponse.json(
      {
        error: 'Failed to check Jellyfin status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export const GET = withLogging(handler);
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/app/api/jellyfin/check/__tests__/route.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/jellyfin/check/
git commit -m "feat: add seasons field to Jellyfin check API"
```

---

### Task 7: Request Service — Season Support

**Files:**
- Modify: `src/lib/request-service.ts`
- Modify: `src/lib/__tests__/request-service.test.ts` (create if not exists)

- [ ] **Step 1: Write test file**

Create `src/lib/__tests__/request-service.test.ts`:

```ts
import { createRequest, createTvRequests } from '../request-service';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
  prisma: {
    request: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../notifications', () => ({
  sendRequestNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock TMDB for createTvRequests
jest.mock('@/lib/tmdb', () => ({
  getTMDBTVDetails: jest.fn(),
}));

describe('request-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('creates a movie request', async () => {
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock).mockResolvedValue({
        id: 1,
        title: 'Test Movie',
        tmdb_id: 123,
        season_number: null,
        media_type: 'movie',
        status: 'pending',
      });

      const result = await createRequest({
        tmdbId: 123,
        title: 'Test Movie',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });

      expect(result.media_type).toBe('movie');
      expect(result.season_number).toBeNull();
    });

    it('creates a TV season request', async () => {
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock).mockResolvedValue({
        id: 2,
        title: 'Test Show',
        tmdb_id: 456,
        season_number: 3,
        media_type: 'tv',
        status: 'pending',
      });

      const result = await createRequest({
        tmdbId: 456,
        title: 'Test Show',
        posterPath: null,
        requestedBy: 'Bob',
        mediaType: 'tv',
        seasonNumber: 3,
      });

      expect(result.media_type).toBe('tv');
      expect(result.season_number).toBe(3);
    });

    it('detects duplicate by tmdb_id + season_number', async () => {
      const existing = { id: 1, tmdb_id: 456, season_number: 3 };
      (prisma.request.findFirst as jest.Mock).mockResolvedValue(existing);

      const result = await createRequest({
        tmdbId: 456,
        title: 'Test Show',
        posterPath: null,
        requestedBy: 'Bob',
        mediaType: 'tv',
        seasonNumber: 3,
      });

      expect(result).toBe(existing);
      expect(prisma.request.create).not.toHaveBeenCalled();
    });

    it('throws when title is missing', async () => {
      await expect(
        createRequest({ tmdbId: 1, title: '', posterPath: null, requestedBy: '', mediaType: 'movie' })
      ).rejects.toThrow('Title and requester name are required');
    });
  });

  describe('createTvRequests', () => {
    it('creates requests for all non-special seasons', async () => {
      const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
      getTMDBTVDetails.mockResolvedValue({
        id: 100,
        name: 'Best Show',
        seasons: [
          { season_number: 0, name: 'Specials', episode_count: 5 },
          { season_number: 1, name: 'Season 1', episode_count: 10 },
          { season_number: 2, name: 'Season 2', episode_count: 8 },
        ],
      });

      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock)
        .mockResolvedValueOnce({ id: 10, tmdb_id: 100, season_number: 1, media_type: 'tv' })
        .mockResolvedValueOnce({ id: 11, tmdb_id: 100, season_number: 2, media_type: 'tv' });

      const results = await createTvRequests(100, 'Alice');

      expect(results).toHaveLength(2);
      expect(results[0].season_number).toBe(1);
      expect(results[1].season_number).toBe(2);
      expect(prisma.request.create).toHaveBeenCalledTimes(2);
    });

    it('skips Season 0 (specials)', async () => {
      const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
      getTMDBTVDetails.mockResolvedValue({
        id: 100,
        name: 'Special Show',
        seasons: [
          { season_number: 0, name: 'Specials', episode_count: 1 },
          { season_number: 1, name: 'Season 1', episode_count: 10 },
        ],
      });

      (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.request.create as jest.Mock).mockResolvedValue({
        id: 12, tmdb_id: 100, season_number: 1, media_type: 'tv',
      });

      const results = await createTvRequests(100, 'Alice');
      expect(results).toHaveLength(1);
      expect(results[0].season_number).toBe(1);
    });

    it('skips already-requested seasons', async () => {
      const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
      getTMDBTVDetails.mockResolvedValue({
        id: 100,
        name: 'Half Done Show',
        seasons: [
          { season_number: 1, name: 'Season 1', episode_count: 10 },
          { season_number: 2, name: 'Season 2', episode_count: 8 },
        ],
      });

      (prisma.request.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 20, tmdb_id: 100, season_number: 1 }) // S1 exists
        .mockResolvedValueOnce(null); // S2 doesn't

      (prisma.request.create as jest.Mock).mockResolvedValue({
        id: 21, tmdb_id: 100, season_number: 2, media_type: 'tv',
      });

      const results = await createTvRequests(100, 'Alice');
      expect(results).toHaveLength(2); // returns both (one existing, one created)
      expect(prisma.request.create).toHaveBeenCalledTimes(1); // only S2 created
    });
  });
});
```

Run: `npx jest src/lib/__tests__/request-service.test.ts`
Expected: FAIL — `createTvRequests is not a function`

- [ ] **Step 2: Update request-service.ts**

Update `src/lib/request-service.ts`:

```ts
import { prisma } from '@/lib/prisma';
import { canTransition, RequestStatus } from '@/lib/request-fsm';
import { sendRequestNotification } from './notifications';
import { logger } from './logger';
import { getTMDBTVDetails } from './tmdb';

export interface CreateRequestInput {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  requestedBy: string;
  releaseDate?: string;
  overview?: string;
  genreIds?: number[];
  mediaType: string;
  seasonNumber?: number;
}

export async function createRequest(input: CreateRequestInput) {
  if (!input.title?.trim() || !input.requestedBy?.trim()) {
    throw new Error('Title and requester name are required');
  }

  const existing = await prisma.request.findFirst({
    where: {
      tmdb_id: input.tmdbId,
      season_number: input.seasonNumber ?? null,
    },
  });
  if (existing) {
    logger.info({ tmdbId: input.tmdbId, seasonNumber: input.seasonNumber, title: input.title, requestId: existing.id }, 'Request already exists');
    return existing;
  }

  const created = await prisma.request.create({
    data: {
      tmdb_id: input.tmdbId,
      title: input.title,
      poster_path: input.posterPath,
      requested_by: input.requestedBy,
      status: 'pending',
      media_type: input.mediaType,
      season_number: input.seasonNumber ?? null,
      release_date: input.releaseDate,
      overview: input.overview,
      genre_ids: input.genreIds ?? [],
    },
  });

  logger.info({ requestId: created.id, tmdbId: input.tmdbId, seasonNumber: input.seasonNumber, title: input.title, mediaType: input.mediaType, requestedBy: input.requestedBy }, 'Request created');

  await sendRequestNotification(created);

  return created;
}

export async function createTvRequests(tmdbId: number, requestedBy: string): Promise<Awaited<ReturnType<typeof createRequest>>[]> {
  if (!requestedBy?.trim()) {
    throw new Error('Requester name is required');
  }

  const details = await getTMDBTVDetails(tmdbId);
  const seasons = details.seasons.filter(s => s.season_number > 0);

  const results: Awaited<ReturnType<typeof createRequest>>[] = [];

  for (const season of seasons) {
    const input: CreateRequestInput = {
      tmdbId,
      title: details.name,
      posterPath: season.poster_path ?? null,
      requestedBy,
      releaseDate: undefined, // TV uses first_air_date from search, not per-season
      overview: undefined,
      genreIds: undefined,
      mediaType: 'tv',
      seasonNumber: season.season_number,
    };

    const existing = await prisma.request.findFirst({
      where: { tmdb_id: tmdbId, season_number: season.season_number },
    });

    if (existing) {
      results.push(existing);
      continue;
    }

    const created = await createRequest(input);
    results.push(created);
  }

  logger.info({ tmdbId, seasonCount: seasons.length, createdCount: results.filter(r => 'id' in r).length, requestedBy }, 'TV show fan-out complete');

  return results;
}

export async function transitionToStatus(requestId: number, targetStatus: RequestStatus) {
  const request = await prisma.request.findUnique({ where: { id: requestId } });

  if (!request) {
    throw new Error('Request not found');
  }

  const currentStatus = request.status as RequestStatus;

  if (!canTransition(currentStatus, targetStatus)) {
    throw new Error(`Cannot transition from ${currentStatus} to ${targetStatus}`);
  }

  return prisma.request.update({
    where: { id: requestId },
    data: { status: targetStatus },
  });
}

export async function fulfillRequest(requestId: number) {
  return transitionToStatus(requestId, 'fulfilled');
}

export async function downloadRequest(requestId: number) {
  return transitionToStatus(requestId, 'downloading');
}

export async function cancelRequest(requestId: number) {
  return transitionToStatus(requestId, 'canceled');
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/lib/__tests__/request-service.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/request-service.ts src/lib/__tests__/request-service.test.ts
git commit -m "feat: add season support and fan-out to request service"
```

---

### Task 8: Server Actions — TV Support

**Files:**
- Modify: `src/app/actions/request-actions.ts`
- Modify: `src/app/actions/__tests__/request-actions.test.ts`

- [ ] **Step 1: Update tests**

The existing `request-actions.test.ts` mocks `prisma` directly and tests server actions end-to-end. Update the test file:

Update imports at line 2 to include `createTvShowRequests`:

```ts
import { createRequest, fulfillRequest, cancelRequest, downloadRequest, createTvShowRequests } from '../request-actions';
```

Update the `createRequest` test expectations. In `src/app/actions/__tests__/request-actions.test.ts`, change the two `createRequest` tests:

The `findUnique` call becomes `findFirst` with `season_number`. Update line 40:

```ts
expect(prisma.request.findFirst).toHaveBeenCalledWith({ where: { tmdb_id: 123, season_number: null } });
```

Update line 43-53 (the `create` expectation) to include `season_number: null`:

```ts
expect(prisma.request.create).toHaveBeenCalledWith({
  data: {
    tmdb_id: 123,
    title: 'Test Movie',
    poster_path: '/path.jpg',
    requested_by: 'John Doe',
    status: 'pending',
    media_type: 'movie',
    season_number: null,
    release_date: '2024-01-01',
    overview: 'A movie',
    genre_ids: [28, 12],
  },
});
```

Update the duplicate test (line 60) from `findUnique` to `findFirst`:

```ts
(prisma.request.findFirst as jest.Mock).mockResolvedValue(existingRequest);
```

And update its mock setup (line 35) — change `findUnique` to `findFirst` in the setup line:

```ts
(prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
```

Also add `findFirst` to the prisma mock setup (line 24):

```ts
(prisma as any).request = {
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};
```

Add a new test for TV season request:

```ts
it('creates a TV request with season_number', async () => {
  const mockRequest = { id: 2, title: 'Test Show', status: 'pending', season_number: 3, media_type: 'tv' };
  (prisma.request.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.request.create as jest.Mock).mockResolvedValue(mockRequest);

  const result = await createRequest(456, 'Test Show', '/path.jpg', 'Alice', undefined, undefined, undefined, 'tv', 3);

  expect(prisma.request.findFirst).toHaveBeenCalledWith({ where: { tmdb_id: 456, season_number: 3 } });
  expect(prisma.request.create).toHaveBeenCalledWith({
    data: {
      tmdb_id: 456,
      title: 'Test Show',
      poster_path: '/path.jpg',
      requested_by: 'Alice',
      status: 'pending',
      media_type: 'tv',
      season_number: 3,
      release_date: undefined,
      overview: undefined,
      genre_ids: [],
    },
  });
  expect(result).toEqual(mockRequest);
});
```

Add a test for `createTvShowRequests`:

```ts
describe('createTvShowRequests', () => {
  it('calls revalidatePath after fan-out', async () => {
    (prisma.request.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // S1
      .mockResolvedValueOnce(null); // S2
    (prisma.request.create as jest.Mock)
      .mockResolvedValueOnce({ id: 10, season_number: 1, status: 'pending', media_type: 'tv' })
      .mockResolvedValueOnce({ id: 11, season_number: 2, status: 'pending', media_type: 'tv' });

    // Mock TMDB
    jest.mock('@/lib/tmdb', () => ({
      getTMDBTVDetails: jest.fn().mockResolvedValue({
        id: 100,
        name: 'Best Show',
        seasons: [
          { season_number: 0, name: 'Specials', episode_count: 5 },
          { season_number: 1, name: 'Season 1', episode_count: 10 },
          { season_number: 2, name: 'Season 2', episode_count: 8 },
        ],
      }),
    }));

    const result = await createTvShowRequests(100, 'Alice');
    expect(revalidatePath).toHaveBeenCalledWith('/requests');
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Update server actions**

Update `src/app/actions/request-actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import {
  createRequest as createRequestImpl,
  fulfillRequest as fulfillRequestImpl,
  downloadRequest as downloadRequestImpl,
  cancelRequest as cancelRequestImpl,
  createTvRequests,
} from '@/lib/request-service';

export async function createRequest(
  tmdbId: number,
  title: string,
  posterPath: string | null,
  requestedBy: string,
  releaseDate?: string,
  overview?: string,
  genreIds?: number[],
  mediaType: string = 'movie',
  seasonNumber?: number
) {
  return createRequestImpl({
    tmdbId,
    title,
    posterPath,
    requestedBy,
    releaseDate,
    overview,
    genreIds,
    mediaType,
    seasonNumber,
  });
}

export async function createTvShowRequests(tmdbId: number, requestedBy: string) {
  const result = await createTvRequests(tmdbId, requestedBy);
  revalidatePath('/requests');
  return result;
}

export async function fulfillRequest(requestId: number) {
  const result = await fulfillRequestImpl(requestId);
  revalidatePath('/requests');
  return result;
}

export async function downloadRequest(requestId: number) {
  const result = await downloadRequestImpl(requestId);
  revalidatePath('/requests');
  return result;
}

export async function cancelRequest(requestId: number) {
  const result = await cancelRequestImpl(requestId);
  revalidatePath('/requests');
  return result;
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/app/actions/__tests__/request-actions.test.ts`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/request-actions.ts src/app/actions/__tests__/request-actions.test.ts
git commit -m "feat: add TV show server actions"
```

---

### Task 9: Notification — Add Season Info

**Files:**
- Modify: `src/lib/notifications.ts`
- Modify: `src/lib/__tests__/notifications.test.ts`

- [ ] **Step 1: Update NotificationRequest interface and email templates**

Update `NotificationRequest` in `src/lib/notifications.ts`:

```ts
export interface NotificationRequest {
  id: number;
  title: string;
  requested_by: string;
  status: string;
  requested_at: Date;
  release_date?: string | null;
  media_type?: string;
  season_number?: number | null;
}
```

In `buildRequestNotificationContent`, update the subject, text, and HTML to include season info for TV:

Replace the subject line:
```ts
const mediaLabel = request.media_type === 'tv' ? 'TV Show' : 'Movie';
const seasonSuffix = request.season_number ? ` — Season ${request.season_number}` : '';
const subject = `[JELLYFIN REQUEST] New Request: ${request.title}${seasonSuffix} (${year})`;
```

Replace the "Movie:" row in the HTML table with a label that adapts:
```ts
<tr>
  <td style="padding: 8px 16px 8px 0; font-weight: bold;">${mediaLabel}:</td>
  <td style="padding: 8px 0; font-size: 1.2em; font-weight: bold;">${escapeHtml(request.title)}${seasonSuffix}</td>
</tr>
```

Replace the text version's "Movie:" line:
```ts
${mediaLabel}: ${request.title}${seasonSuffix}
```

- [ ] **Step 2: Update daily summary content**

In `buildDailySummaryContent`, update the list item to show season:

```ts
const seasonLabel = req.season_number ? ` S${req.season_number}` : '';
text += `- "${req.title}"${seasonLabel} (${year}) — requested by ${req.requested_by} (${req.status})\n`;
```

```ts
html += `<li style="margin: 8px 0;">
  <strong>${escapeHtml(req.title)}</strong>${seasonLabel} (${year}) — 
  requested by ${escapeHtml(req.requested_by)} (${escapeHtml(req.status)}) 
  <a href="${requestUrl}">View</a>
</li>`;
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/lib/__tests__/notifications.test.ts`
Expected: All PASS (existing tests should still pass)

- [ ] **Step 4: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: add season info to notification emails"
```

---

### Task 10: Search Page — Tabs, TV Search, Season Picker

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rewrite the search page with TV support**

This is the largest UI change. Replace the contents of `src/app/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createRequest, createTvShowRequests } from '@/app/actions/request-actions';
import { RequestForm } from '@/components/RequestForm';
import { JellyfinBadge } from '@/components/JellyfinBadge';
import { GENRE_MAP } from '@/lib/genres';
import { logger } from '@/lib/logger';

type SearchType = 'movie' | 'tv';

interface TMDBMovieResult {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  poster_path?: string;
  genre_ids?: number[];
}

interface TMDBSeriesResult {
  id: number;
  name: string;
  overview?: string;
  first_air_date?: string;
  poster_path?: string;
  genre_ids?: number[];
}

interface JellyfinCheckResponse {
  results: Record<number, boolean>;
  seasons: Record<number, number[]>;
  error?: string;
  configured: boolean;
}

interface TMDBSeason {
  season_number: number;
  name: string;
  episode_count: number;
}

function getGenreNamesDisplay(ids: number[] | undefined): string {
  if (!ids?.length) return '';
  return ids.map(id => GENRE_MAP[id]).filter(Boolean).join(', ');
}

function getYear(date: string | undefined): string {
  return date?.split('-')[0] || '';
}

export default function ImportPage() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('movie');
  const [movieResults, setMovieResults] = useState<TMDBMovieResult[]>([]);
  const [tvResults, setTvResults] = useState<TMDBSeriesResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jellyfinResults, setJellyfinResults] = useState<Record<number, boolean>>({});
  const [jellyfinSeasons, setJellyfinSeasons] = useState<Record<number, number[]>>({});
  const [tmdbSeasons, setTmdbSeasons] = useState<Record<number, TMDBSeason[]>>({});
  const [requesting, setRequesting] = useState<string | null>(null); // format: "showId-seasonNum" or "movieId"
  const [jellyfinError, setJellyfinError] = useState<string | null>(null);

  const currentResults = searchType === 'movie' ? movieResults : tvResults;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setJellyfinError(null);
    setMovieResults([]);
    setTvResults([]);

    try {
      const res = await fetch(`/api/tmdb/search?type=${searchType}&q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.details || 'Search failed');
      }
      const data = await res.json();

      if (searchType === 'movie') {
        setMovieResults(data.results);
        const ids: number[] = data.results.map((m: TMDBMovieResult) => m.id);
        if (ids.length > 0) {
          const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${ids.join(',')}`);
          const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
          if (jellyfinData.error) setJellyfinError(jellyfinData.error);
          setJellyfinResults(jellyfinData.results || {});
        }
      } else {
        setTvResults(data.results);
        const ids: number[] = data.results.map((s: TMDBSeriesResult) => s.id);
        if (ids.length > 0) {
          const [jellyfinRes, seasonsRes] = await Promise.all([
            fetch(`/api/jellyfin/check?ids=${ids.join(',')}`),
            fetch(`/api/tmdb/tv/seasons?ids=${ids.join(',')}`),
          ]);
          const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
          const seasonsData = await seasonsRes.json();

          if (jellyfinData.error) setJellyfinError(jellyfinData.error);
          setJellyfinResults(jellyfinData.results || {});
          setJellyfinSeasons(jellyfinData.seasons || {});
          setTmdbSeasons(seasonsData.seasons || {});
        }
      }
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Search failed');
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMovieRequest = async (movie: TMDBMovieResult, requestedBy: string) => {
    try {
      await createRequest(movie.id, movie.title, movie.poster_path || null, requestedBy, movie.release_date, movie.overview, movie.genre_ids, 'movie');
      setRequesting(null);
      const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${movie.id}`);
      const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
      setJellyfinResults(prev => ({ ...prev, [movie.id]: jellyfinData.results[movie.id] || false }));
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to create request');
    }
  };

  const handleSeasonRequest = async (show: TMDBSeriesResult, seasonNumber: number, requestedBy: string) => {
    try {
      await createRequest(show.id, show.name, show.poster_path || null, requestedBy, show.first_air_date, show.overview, show.genre_ids, 'tv', seasonNumber);
      setRequesting(null);
      const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${show.id}`);
      const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
      setJellyfinSeasons(prev => ({ ...prev, [show.id]: jellyfinData.seasons[show.id] || [] }));
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to create request');
    }
  };

  const handleRequestAllSeasons = async (show: TMDBSeriesResult, requestedBy: string) => {
    try {
      await createTvShowRequests(show.id, requestedBy);
      setRequesting(null);
      const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${show.id}`);
      const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
      setJellyfinSeasons(prev => ({ ...prev, [show.id]: jellyfinData.seasons[show.id] || [] }));
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to create TV requests');
    }
  };

  return (
    <main className="page-container">
      <h1 className="page-title">Search</h1>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => { setSearchType('movie'); setMovieResults([]); setTvResults([]); }}
          className={`px-4 py-2 rounded text-sm font-medium ${searchType === 'movie' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          Movies
        </button>
        <button
          type="button"
          onClick={() => { setSearchType('tv'); setMovieResults([]); setTvResults([]); }}
          className={`px-4 py-2 rounded text-sm font-medium ${searchType === 'tv' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          TV Shows
        </button>
      </div>

      <form onSubmit={handleSearch} className="form-row-lg">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search for a ${searchType === 'movie' ? 'movie' : 'TV show'}...`}
          className="input flex-1"
        />
        <button type="submit" disabled={loading} className="btn-primary btn-md">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && <div className="alert-error">{error}</div>}
      {jellyfinError && <div className="alert-warning"><strong>Jellyfin Status:</strong> {jellyfinError}</div>}

      <div className="space-y-3">
        {currentResults.map((item) => {
          if (searchType === 'movie') {
            const movie = item as TMDBMovieResult;
            const onJellyfin = jellyfinResults[movie.id] || false;
            const reqKey = String(movie.id);
            const isRequesting = requesting === reqKey;

            return (
              <div key={movie.id} className="card-row">
                {movie.poster_path ? (
                  <a href={`https://www.themoviedb.org/movie/${movie.id}`} target="_blank" rel="noopener noreferrer" className="poster-sm">
                    <Image src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} alt={movie.title} width={64} height={96} className="poster-img" />
                  </a>
                ) : (
                  <div className="poster-sm bg-muted rounded-sm" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="card-title">
                        <a href={`https://www.themoviedb.org/movie/${movie.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {movie.title}
                        </a>
                        <span className="ml-2 text-sm font-normal text-year">{getYear(movie.release_date)}</span>
                      </h3>
                      {movie.genre_ids && movie.genre_ids.length > 0 && (
                        <p className="text-xs text-muted mb-1">{getGenreNamesDisplay(movie.genre_ids)}</p>
                      )}
                    </div>
                    <JellyfinBadge available={onJellyfin} />
                  </div>
                  {movie.overview && <p className="text-body line-clamp-2 mb-2">{movie.overview}</p>}
                  {!onJellyfin && !isRequesting && (
                    <button onClick={() => setRequesting(reqKey)} className="btn-primary btn-sm">Request</button>
                  )}
                  {isRequesting && (
                    <RequestForm isVisible={true} onSubmit={(requestedBy) => handleMovieRequest(movie, requestedBy)} onCancel={() => setRequesting(null)} />
                  )}
                </div>
              </div>
            );
          }

          // TV show card
          const show = item as TMDBSeriesResult;
          const showId = show.id;
          const availableSeasons = jellyfinSeasons[showId] || [];
          const allSeasons = tmdbSeasons[showId] || [];
          const regularSeasons = allSeasons.filter(s => s.season_number > 0);
          const missingSeasons = regularSeasons.filter(s => !availableSeasons.includes(s.season_number));
          const hasRequestedAll = missingSeasons.length === 0 && regularSeasons.length > 0;

          return (
            <div key={show.id} className="card-row">
              {show.poster_path ? (
                <a href={`https://www.themoviedb.org/tv/${show.id}`} target="_blank" rel="noopener noreferrer" className="poster-sm">
                  <Image src={`https://image.tmdb.org/t/p/w185${show.poster_path}`} alt={show.name} width={64} height={96} className="poster-img" />
                </a>
              ) : (
                <div className="poster-sm bg-muted rounded-sm" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="card-title">
                      <a href={`https://www.themoviedb.org/tv/${show.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {show.name}
                      </a>
                      <span className="ml-2 text-sm font-normal text-year">{getYear(show.first_air_date)}</span>
                    </h3>
                    {show.genre_ids && show.genre_ids.length > 0 && (
                      <p className="text-xs text-muted mb-1">{getGenreNamesDisplay(show.genre_ids)}</p>
                    )}
                  </div>
                </div>
                {show.overview && <p className="text-body line-clamp-2 mb-2">{show.overview}</p>}

                {/* Seasons row */}
                {regularSeasons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {regularSeasons.map((season) => {
                      const isAvailable = availableSeasons.includes(season.season_number);
                      const reqKey = `${showId}-${season.season_number}`;
                      const isRequesting = requesting === reqKey;

                      return (
                        <div key={season.season_number} className="flex items-center gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            isAvailable ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-muted text-muted-foreground'
                          }`}>
                            S{season.season_number}
                          </span>
                          {!isAvailable && !isRequesting && (
                            <button
                              onClick={() => setRequesting(reqKey)}
                              className="btn-primary btn-xs text-xs px-2 py-0.5"
                            >
                              Request
                            </button>
                          )}
                          {isRequesting && (
                            <RequestForm
                              isVisible={true}
                              onSubmit={(requestedBy) => handleSeasonRequest(show, season.season_number, requestedBy)}
                              onCancel={() => setRequesting(null)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Request All Missing button */}
                {missingSeasons.length > 0 && (
                  <div>
                    <button
                      onClick={() => setRequesting(`${showId}-all`)}
                      className="btn-primary btn-sm"
                    >
                      Request All Missing Seasons ({missingSeasons.length})
                    </button>
                    {requesting === `${showId}-all` && (
                      <RequestForm
                        isVisible={true}
                        onSubmit={(requestedBy) => handleRequestAllSeasons(show, requestedBy)}
                        onCancel={() => setRequesting(null)}
                      />
                    )}
                  </div>
                )}

                {hasRequestedAll && regularSeasons.length > 0 && (
                  <span className="text-xs text-green-600">All seasons already available or requested</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify build with typecheck**

Run: `npm run typecheck`
Expected: PASS (no TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add TV search tabs and season-level request UI"
```

---

### Task 11: RequestListItem — Media Type Badge, Season Info

**Files:**
- Modify: `src/components/RequestListItem.tsx`
- Modify: `src/components/__tests__/RequestListItem.test.tsx`

- [ ] **Step 1: Update Request interface and add media type badge + season info**

Update the `Request` interface in `src/components/RequestListItem.tsx`:

```ts
export interface Request {
  id: number;
  title: string;
  tmdb_id?: number;
  season_number?: number | null;
  poster_path?: string;
  overview?: string;
  release_date?: string;
  genre_ids?: number[];
  requested_by: string;
  requested_at: string;
  status: RequestStatus;
  media_type?: string;
}
```

In the JSX, add a media type badge after the title line. Replace the `<h3>` section (lines 101-108):

```tsx
<h3 className="font-semibold">
  {request.title}
  {request.season_number && (
    <span className="ml-1 text-sm font-normal text-year">— Season {request.season_number}</span>
  )}
  {request.release_date && request.media_type !== 'tv' && (
    <span className="ml-2 text-sm font-normal text-year">
      ({request.release_date.split('-')[0]})
    </span>
  )}
</h3>
<span className={`px-2 py-0.5 text-xs rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
  {statusConfig.label}
</span>
{request.media_type === 'tv' && (
  <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
    TV
  </span>
)}
```

Also update the TMDB link. The poster image link (line 103) and the <a> around the title — change to use `/tv/` for TV shows:

```tsx
const tmdbUrl = request.tmdb_id
  ? `https://www.themoviedb.org/${request.media_type === 'tv' ? 'tv' : 'movie'}/${request.tmdb_id}`
  : '#';
```

Apply this URL to both the poster link and the title link.

- [ ] **Step 2: Update test expectations**

In `src/components/__tests__/RequestListItem.test.tsx`, add a test for TV badge display:

```tsx
it('shows TV badge and season for TV requests', () => {
  const tvRequest: Request = {
    id: 1,
    title: 'Best Show',
    tmdb_id: 100,
    season_number: 3,
    media_type: 'tv',
    requested_by: 'Alice',
    requested_at: '2026-01-01',
    status: 'pending',
  };
  render(<RequestListItem request={tvRequest} />);
  expect(screen.getByText('TV')).toBeInTheDocument();
  expect(screen.getByText(/Season 3/)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests**

Run: `npx jest src/components/__tests__/RequestListItem.test.tsx`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/RequestListItem.tsx src/components/__tests__/RequestListItem.test.tsx
git commit -m "feat: add TV badge and season info to request list items"
```

---

### Task 12: Requests Page — Pass media_type and season_number

**Files:**
- Modify: `src/app/requests/page.tsx`
- Modify: `src/components/RequestList.tsx`

The requests page queries data and passes it to RequestList. The Prisma query already selects all columns, so `media_type` and `season_number` will come through automatically. The type mapping in the page needs to include these fields.

- [ ] **Step 1: Update RequestList props and typed request mapping**

In `src/app/requests/page.tsx`, update the typed request mapping (lines 42-50) to include `media_type` and `season_number`:

```ts
const typedRequests = requests.map(r => ({
  ...r,
  tmdb_id: r.tmdb_id ?? undefined,
  poster_path: r.poster_path ?? undefined,
  overview: r.overview ?? undefined,
  release_date: r.release_date ?? undefined,
  requested_at: r.requested_at.toISOString(),
  status: r.status as RequestStatus,
  season_number: r.season_number ?? undefined,
  media_type: r.media_type ?? undefined,
}));
```

- [ ] **Step 2: Update RequestList jellyfin availability logic**

In `src/components/RequestList.tsx`, the `jellyfinAvailability` prop is `Record<number, boolean>` and currently maps by `tmdb_id`. For TV shows with the same TMDB ID but different seasons, this still works (all seasons share the same TMDB ID, so the whole-show Jellyfin bool tells us the show exists). The per-season detail is handled on the search page, not here on the requests list.

No functional change needed.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/requests/page.tsx
git commit -m "fix: pass media_type and season_number to request list"
```

---

### Task 13: Full Validation

- [ ] **Step 1: Run the full check pipeline**

```bash
npm run check
```

Expected: All steps pass — `db:generate-client`, `lint` (0 warnings), `test` (0 failures), `typecheck`, `build`.

- [ ] **Step 2: Fix any failures**

If linting, tests, typecheck, or build fail, fix the issues and re-run.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: final validation fixes"
```

---
