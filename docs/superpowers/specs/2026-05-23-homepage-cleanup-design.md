# Home Page Cleanup — Design Spec

**Date:** 2026-05-23
**Scope:** UI adjustments to the MovieDB home page, movie listing, and detail page.

---

## 1. Goals

1. Shrink `MovieCard` poster images by at least 60%.
2. Make `/movies` the default page (redirect `/` → `/movies`).
3. Add ability to delete a movie from the detail page.
4. Remove all manual-add-movie UI: nav link, route, view, and controller.

---

## 2. Architecture

```
next.config.ts
  └── Redirects "/" → "/movies" (permanent)

src/app/layout.tsx
  └── Nav: "MovieDB" logo (links home → /movies), "+ Import Movie" only

src/app/page.tsx
  └── Removed (redirect handled by next.config.ts)

src/app/movies/page.tsx (existing, unchanged)
  └── Shows MovieGrid with smaller MovieCard images

src/app/movies/[id]/page.tsx
  └── Shows movie details + new DeleteMovieButton

src/app/components/DeleteMovieButton.tsx (new)
  └── "Delete Movie" button → confirm dialog → server action → redirect

src/app/actions/movie.ts
  └── New `deleteMovie()` server action
```

---

## 3. Components

### 3.1 `MovieCard` — Modified (`src/app/components/MovieCard.tsx`)

**Change:** Reduce the rendered poster size by at least 60%.

Since the card is a block-level element that fills the grid column, we shrink the poster container itself rather than changing grid columns. The current poster container uses `w-full`. We will change it to a fixed narrow width (`w-32`, which is 128px) while keeping `aspect-[2/3]` and `fill` behavior. This shrinks the poster from ~300px (on desktop grid) to ~128px, a reduction of ~57% in width and ~82% in area.

- Update poster wrapper from full width to a fixed narrow width.
- Update `sizes` attribute on `<Image>` to match new dimensions.
- Keep hover scale effect and text layout unchanged.

### 3.2 `DeleteMovieButton` — New (`src/app/components/DeleteMovieButton.tsx`)

**Props:**
```typescript
interface DeleteMovieButtonProps {
  movieId: number;
}
```

**Behavior:**
1. Renders a red-outlined or solid-red "Delete Movie" button.
2. On click: `confirm("Are you sure you want to delete this movie? This action cannot be undone.")`.
3. If confirmed: call `deleteMovie(movieId)` server action.
4. On success: `toast.success('Movie deleted')` then `router.push('/movies')`.
5. On error: `toast.error(message)` with button enabled for retry.

**Why `confirm()` instead of a custom modal:** Zero additional state or DOM overhead; sufficient for a destructive action confirmation.

### 3.3 `deleteMovie()` — Server Action (`src/app/actions/movie.ts`)

```typescript
export async function deleteMovie(movieId: number): Promise<void> {
  // 1. Validate movieId is a positive integer (z.coerce.number().positive())
  // 2. Check movie exists: prisma.movie.findUnique({ where: { id: movieId } })
  // 3. If not found, throw Error(`Movie with ID ${movieId} not found`)
  // 4. Delete: prisma.movie.delete({ where: { id: movieId } })
}
```

---

## 4. Redirect `/` → `/movies`

Use Next.js config-level redirects (not `redirect()` in a page component) since it is clean and works at the edge.

**File:** `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  // ... existing config ...
  async redirects() {
    return [
      {
        source: '/',
        destination: '/movies',
        permanent: true,
      },
    ];
  },
};
```

This is a permanent (301) redirect.

---

## 5. Nav Cleanup (`src/app/layout.tsx`)

**Remove:**
- The "+ Add Movie" link (`/movies/new`).
- The `/movies/new/page.tsx` route file.
- The `/movies/new/MovieForm.tsx` component file.

**Keep:**
- "+ Import Movie" link (`/movies/import`).
- The `MovieDB` logo link (now points to `/movies`).

---

## 6. Data Flow

### Delete Movie Flow

```
User clicks Delete → confirm() → deleteMovie(movieId)
  → Prisma findUnique + delete
    → Success → toast + router.push('/movies')
    → Error → toast error
```

---

## 7. Error Handling

| Component / Layer | Error | Behavior |
|-------------------|-------|----------|
| `deleteMovie()` | Invalid movieId | Throws descriptive error |
| `deleteMovie()` | Movie not found | Throws `Movie with ID X not found` |
| `deleteMovie()` | Prisma failure | Throws raw error message caught by UI |
| `DeleteMovieButton` | Server action rejection | Toast error, button stays enabled |

---

## 8. Testing

### Unit Tests (`src/app/actions/movie.test.ts`)

Add two new test cases for `deleteMovie`:

1. **Success:** Deletes an existing movie; asserts `prisma.movie.delete` called with correct ID.
2. **Not Found:** Throws `Movie with ID X not found` when movie does not exist.
3. **Invalid ID:** Throws validation error for non-positive or non-numeric ID.

### Manual Verification Checklist

- [ ] Home page (`/`) 301 redirects to `/movies`.
- [ ] Movie cards on `/movies` are visually smaller (poster shrunk).
- [ ] Detail page has a visible "Delete Movie" button.
- [ ] Clicking Delete shows a confirmation dialog.
- [ ] Canceling the dialog does nothing.
- [ ] Confirming deletes the movie and redirects to `/movies`.
- [ ] Nav shows only "MovieDB" and "+ Import Movie".
- [ ] `/movies/new` returns 404.

---

## 9. Files to Modify / Create / Delete

| File | Action |
|------|--------|
| `next.config.ts` | Modify — add `redirects` array |
| `src/app/layout.tsx` | Modify — remove "+ Add Movie" nav link |
| `src/app/page.tsx` | **Delete** (redirect handled by next.config) |
| `src/app/components/MovieCard.tsx` | Modify — shrink poster container |
| `src/app/movies/[id]/page.tsx` | Modify — import and render `DeleteMovieButton` |
| `src/app/actions/movie.ts` | Modify — add `deleteMovie()` action |
| `src/app/actions/movie.test.ts` | Modify — add `deleteMovie` tests |
| `src/app/components/DeleteMovieButton.tsx` | **Create** |
| `src/app/movies/new/page.tsx` | **Delete** |
| `src/app/movies/new/MovieForm.tsx` | **Delete** |
