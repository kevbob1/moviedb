# Design: Jellyfin "Is It On?" + Request Tracker

**Date:** 2026-05-23

## Overview

Replace the existing `Movie` model and movies CRUD with a **Request tracker**. The primary workflow becomes: search a title → check if it's already on Jellyfin → if not, request it. Requests track who asked for content and whether it has been fulfilled.

The existing `Movie` model and `movies` table are removed entirely as part of this change.

---

## Data Model

Remove the `Movie` model. Add a `Request` model:

```prisma
model Request {
  id           Int      @id @default(autoincrement())
  title        String
  tmdb_id      Int?     @unique
  poster_path  String?
  requested_at DateTime @default(now())
  requested_by String
  status       String   @default("pending")  // "pending" | "downloading" | "fulfilled"
  media_type   String   @default("movie")    // "movie" | "tv" (future)

  @@map("requests")
}
```

### Notes
- `requested_by` is a freeform string, required — no auth system, just a name.
- `tmdb_id` is optional (in case a title can't be found on TMDB) but unique when present.
- `media_type` defaults to `"movie"`. `"tv"` is reserved for future use; no TV UI is built now.
- `status` is stored as a plain string rather than an enum to keep migrations simple.

---

## Jellyfin Library (`src/lib/jellyfin.ts`)

New module with two exported functions:

### `isMovieOnJellyfin(tmdbId: number): Promise<boolean>`

Queries the Jellyfin Items API:
```
GET {JELLYFIN_URL}/Items?AnyProviderIdEquals=tmdb.{tmdbId}&IncludeItemTypes=Movie
Authorization: MediaBrowser Token="{JELLYFIN_API_KEY}"
```

Returns `true` if at least one result is returned. Returns `false` on:
- Missing `JELLYFIN_URL` or `JELLYFIN_API_KEY` env vars
- Network error
- Non-2xx response
- Empty results

### `areMoviesOnJellyfin(tmdbIds: number[]): Promise<Map<number, boolean>>`

Makes a single Jellyfin Items call for a list of TMDB IDs. Used by the requests list page to avoid N separate calls per page render. Returns a `Map<tmdbId, boolean>`.

If `tmdbIds` is empty, returns an empty map immediately without hitting the API.

### Configuration

| Env var | Purpose |
|---|---|
| `JELLYFIN_URL` | Base URL of the Jellyfin server (e.g. `http://jellyfin:8096`) |
| `JELLYFIN_API_KEY` | Jellyfin API key |

If either is absent, all checks return `false` silently. The feature degrades gracefully — pages render normally, Jellyfin indicators are simply omitted.

---

## Import / Search Flow

Route: `/movies/import` (kept for now, can be renamed later)

The current flow searches TMDB and saves to the `Movie` model. The new flow:

1. User types a title — TMDB search runs server-side as before
2. Results are displayed with a Jellyfin availability check — one `areMoviesOnJellyfin` call for all TMDB IDs in the result set; results without a TMDB ID default to `false`
3. For each result:
   - **On Jellyfin** → "Already on Jellyfin" badge. No action available.
   - **Not on Jellyfin** → "Request" button shown
4. Clicking "Request" reveals an inline form asking for `requested_by` (required freeform text)
5. Submitting creates a `Request` record and shows a confirmation

If a `Request` already exists for that `tmdb_id`, the button shows "Already requested" instead.

---

## Requests List Page

Route: `/movies` (existing route, repurposed)

Displays all `Request` records, most recently requested first. Each card shows:
- Poster (from TMDB poster path)
- Title
- `requested_by`
- `requested_at` (relative or absolute date)
- Status badge: **Pending** (yellow), **Downloading** (blue), or **Fulfilled** (green)
- Jellyfin availability indicator (live check via `areMoviesOnJellyfin` batch call)

A **"Mark fulfilled"** button on each card updates `status` to `"fulfilled"` via a server action.

Filtering/search: basic title search (same as current movies page). No pagination change required.

---

## UI Components

| Component | Purpose |
|---|---|
| `JellyfinBadge` | Small indicator: "On Jellyfin" or hidden. Used on request cards and import results. |
| `RequestCard` | Replaces `MovieCard`. Shows poster, title, requester, date, status, Jellyfin badge, fulfill button. |
| `RequestGrid` | Replaces `MovieGrid`. Renders a grid of `RequestCard`. |
| `RequestForm` | Inline form for `requested_by` field, shown after clicking "Request" on an import result. |

Existing components removed: `MovieCard`, `MovieGrid`, `DeleteMovieButton`, `SimilarMovies` (no longer applicable without the movie model).

---

## Pages & Routes Summary

| Route | Before | After |
|---|---|---|
| `/movies` | Movie list | Request list |
| `/movies/import` | TMDB search → save movie | TMDB search → Jellyfin check → create request |
| `/movies/[id]` | Movie detail | Removed (requests have no detail page) |

---

## Error Handling

- Jellyfin unreachable: all checks return `false`, UI omits indicator, no page error
- TMDB unreachable: import search shows an error message (existing behavior)
- Duplicate request (same `tmdb_id`): show "Already requested" state, no DB write
- Missing `requested_by`: form validation prevents submission

---

## What Is Removed

- `Movie` Prisma model and `movies` table (via migration)
- `MovieCard`, `MovieGrid` components
- `DeleteMovieButton` component
- `SimilarMovies` component
- Movie detail page (`/movies/[id]`)
- All server actions and API routes related to movies

---

## Out of Scope

- TV series requests (media_type reserved but no UI)
- Authentication / per-user request tracking
- Automatic fulfillment detection via Jellyfin re-check
- Notifications when requests are fulfilled
- Admin vs. user roles
