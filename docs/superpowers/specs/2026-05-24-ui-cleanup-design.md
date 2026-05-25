# UI Cleanup Design

**Date:** 2026-05-24
**Topic:** UI Cleanup — Rename routes, update nav, restyle request cards, and add movie info

---

## Goals

1. Rename `/movies` route to `/requests`.
2. Remove the search bar from `/requests`.
3. Add a centered page header linking to `/` with large font text **"Is It On Jellyfin?"**.
4. Remove the separate nav link for the same, since `/` is the default landing page.
5. Add a "View Requests" nav link.
6. Improve button styles for request cards: **cancel** red, **downloading** blue, **fulfilled** green.
7. Add more movie info to request list cards: **year**, **description**, and **genres**.
8. After clicking an action button on a request card, the card refreshes to reflect the current DB state.

---

## Architecture

### Route Changes

| Old Route | New Route | Content |
|-----------|-----------|---------|
| `/search` | `/`       | Movie search & request form (landing page) |
| `/movies` | `/requests` | List of all requests |

- `/search/page.tsx` moves to `src/app/page.tsx`.
- `/movies/page.tsx` moves to `src/app/requests/page.tsx`.
- Update all internal links (layout nav, any hardcoded paths).
- Add `redirect` or `notFound` for old routes if desired (out of scope for this change; Next.js 404 is acceptable).

### Navigation (`layout.tsx`)

- **Header**: Centered large-font link: `<Link href="/">Is It On Jellyfin?</Link>`.
- **Nav links**:
  - "View Requests" → `/requests`
- Remove "Is it on Jellyfin?" nav link (page title now serves as the link to home).
- Update metadata title to "Is It On Jellyfin?".

### Request List Page (`/requests`)

- **Remove** `<SearchInput>` component.
- Keep `<ShowFulfilledCheckbox>` and `<Pagination>`.
- Keep page title "Requests" (or remove if redundant with nav).

### Request Card (`RequestListItem`)

- **Layout** (list item, not grid):
  - Poster thumbnail on the left.
  - Right side stacked vertically:
    1. Title + year inline.
    2. Status badge.
    3. Description (2-line clamp).
    4. Genres (comma-separated).
    5. Requester + date.
    6. Action buttons.
- **Button colors** (per action type):
  - `download` / `Start Download`: blue (`bg-blue-600`, `hover:bg-blue-700`)
  - `fulfill` / `Mark Fulfilled`: green (`bg-green-600`, `hover:bg-green-700`)
  - `cancel` / `Cancel`: red (`bg-red-600`, `hover:bg-red-700`)
- **Action refresh**: Server action calls `revalidatePath('/requests')` so Next.js re-renders the server component. The card reflects the new status and available actions automatically.

### Data Flow for Movie Info

- **Source**: Store in DB on request creation.
- **Schema change**: Add `release_date` (String?), `overview` (String?), and `genre_ids` (Int[]?) to the `Request` model.
- **Creation**: Update `createRequest` in `request-service.ts` and `request-actions.ts` to accept and store these fields.
- **Display**: Read directly from the `Request` record in `RequestListItem`.
- **Existing requests**: Will lack the new fields and display empty strings / nothing for year, description, and genres.

---

## Components

| Component | Purpose | Changes |
|-----------|---------|---------|
| `layout.tsx` | Root layout with nav | Update header, nav links, metadata |
| `src/app/page.tsx` (new) | Landing search page | Move current `/search/page.tsx` |
| `src/app/requests/page.tsx` (new) | Request list | Move current `/movies/page.tsx`, remove search bar |
| `RequestListItem` | Individual request card | Add year, description, genres; style buttons; action refresh |
| `request-actions.ts` | Server actions for status transitions | Add `revalidatePath('/requests')` after each transition |
| `request-service.ts` | Business logic for requests | Accept and store new fields on create |
| Prisma `Request` model | DB schema | Add `release_date`, `overview`, `genre_ids` |

---

## Data Model Changes

```prisma
model Request {
  id           Int      @id @default(autoincrement())
  title        String
  tmdb_id      Int?     @unique
  poster_path  String?
  release_date String?
  overview     String?
  genre_ids    Int[]
  requested_at DateTime @default(now())
  requested_by String
  status       String   @default("pending")
  media_type   String   @default("movie")

  @@map("requests")
}
```

A new migration is required after updating `schema.prisma`.

---

## Error Handling

- Action failures (e.g., invalid transition) are caught and logged in `RequestListItem`. The `revalidatePath` is only called on success.
- If TMDB data is missing during creation, the new fields are nullable so the request still succeeds.

---

## Testing Considerations

- Update existing tests that reference `/movies` to use `/requests`.
- Update `RequestListItem` tests to assert new fields are rendered.
- Update action tests to verify `revalidatePath` is called.
- Run `npm run check` before committing.

---

## Dependencies

- `next/cache` (for `revalidatePath`)
- Existing Prisma setup

---

## Out of Scope

- Backwards-compatible redirects for old `/search` and `/movies` routes.
- Populating historical requests with missing movie info.
- Visual companion mockups (design approved verbally).
