# Home Page Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink movie card images, redirect `/` to `/movies`, add movie delete on detail page, and remove manual add movie flow.

**Architecture:**
- Add `deleteMovie()` server action to `src/app/actions/movie.ts` with Zod validation.
- Create a client-side `DeleteMovieButton` that calls the action via `confirm()` and redirects on success.
- Wire redirect in `next.config.ts` and remove the old `/movies/new` route and nav link.
- Shrink `MovieCard` poster container from `w-full` to `w-32`.

**Tech Stack:** Next.js 15 App Router, Prisma, React, Tailwind CSS, Zod, Jest

---

## File Structure

| File | Role |
|------|------|
| `src/app/actions/movie.ts` | Server actions: `createMovie`, new `deleteMovie` |
| `src/app/actions/movie.test.ts` | Jest tests for `createMovie` and `deleteMovie` |
| `src/app/components/DeleteMovieButton.tsx` | New client component: delete button with confirm + toast |
| `src/app/movies/[id]/page.tsx` | Detail page: renders movie info + `DeleteMovieButton` |
| `src/app/components/MovieCard.tsx` | Movie grid card: shrink poster container |
| `src/app/layout.tsx` | Root layout: nav bar with only "+ Import Movie" |
| `next.config.ts` | Config: `/` → `/movies` permanent redirect |
| `src/app/page.tsx` | Old root page: **delete** (redirect handled by config) |
| `src/app/movies/new/page.tsx` | Old manual add page: **delete** |
| `src/app/movies/new/MovieForm.tsx` | Old manual add form: **delete** |

---

### Task 1: Add `deleteMovie` server action

**Files:**
- Modify: `src/app/actions/movie.ts`
- Modify: `src/app/actions/movie.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/app/actions/movie.test.ts`:

```typescript
import { deleteMovie } from './movie';
// ... existing imports ...

const mockDelete = prisma.movie.delete as jest.Mock;

describe('deleteMovie', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes an existing movie', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 1, title: 'Test Movie' });
    mockDelete.mockResolvedValueOnce({ id: 1, title: 'Test Movie' });

    await deleteMovie(1);

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('throws if movie does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(deleteMovie(999)).rejects.toThrow('Movie with ID 999 not found');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('throws for invalid movieId', async () => {
    await expect(deleteMovie(-1)).rejects.toThrow('ID must be a positive number');
    await expect(deleteMovie(0)).rejects.toThrow('ID must be a positive number');
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/actions/movie.test.ts --verbose`

Expected: FAIL with "deleteMovie is not defined" or similar.

- [ ] **Step 3: Add `deleteMovie()` implementation**

In `src/app/actions/movie.ts`, after the existing `createMovie`, add:

```typescript
const idSchema = z.number().positive('ID must be a positive number');

export async function deleteMovie(movieId: number) {
  const validatedId = idSchema.parse(movieId);

  const existingMovie = await prisma.movie.findUnique({
    where: { id: validatedId },
  });

  if (!existingMovie) {
    throw new Error(`Movie with ID ${validatedId} not found`);
  }

  try {
    await prisma.movie.delete({ where: { id: validatedId } });
  } catch (error) {
    throw new Error(`Failed to delete movie: ${(error as Error).message}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/movie.test.ts --verbose`

Expected: All 5 tests PASS (2 existing create tests + 3 new delete tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/movie.ts src/app/actions/movie.test.ts
git commit -m "feat: add deleteMovie server action with tests"
```

---

### Task 2: Create `DeleteMovieButton` component

**Files:**
- Create: `src/app/components/DeleteMovieButton.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/components/DeleteMovieButton.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { deleteMovie } from '@/app/actions/movie';

interface DeleteMovieButtonProps {
  movieId: number;
}

export function DeleteMovieButton({ movieId }: DeleteMovieButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this movie? This action cannot be undone.'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteMovie(movieId);
      toast.success('Movie deleted successfully!');
      router.push('/movies');
    } catch (error) {
      toast.error(`Failed to delete movie: ${(error as Error).message}`);
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="mt-6 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isDeleting ? 'Deleting...' : 'Delete Movie'}
    </button>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors in `DeleteMovieButton.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/DeleteMovieButton.tsx
git commit -m "feat: add DeleteMovieButton client component"
```

---

### Task 3: Wire `DeleteMovieButton` into detail page

**Files:**
- Modify: `src/app/movies/[id]/page.tsx`

- [ ] **Step 1: Import and place the button**

In `src/app/movies/[id]/page.tsx`, add the import at the top:

```typescript
import { DeleteMovieButton } from '@/app/components/DeleteMovieButton';
```

Then, inside the component, after the closing `</div>` of the flex row (after the movie description) and before the `SimilarMovies` section, add:

```tsx
      <div className="mt-6">
        <DeleteMovieButton movieId={movie.id} />
      </div>
```

The full bottom of the component should look like:

```tsx
          {movie.description && (
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
              {movie.description}
            </p>
          )}

          <DeleteMovieButton movieId={movie.id} />
        </div>
      </div>

      {movie.tmdb_id && (
        <div className="mt-12">
          <SimilarMovies tmdbId={movie.tmdb_id} />
        </div>
      )}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/movies/[id]/page.tsx
git commit -m "feat: add delete button to movie detail page"
```

---

### Task 4: Add `/` → `/movies` redirect

**Files:**
- Modify: `next.config.ts`
- Delete: `src/app/page.tsx`

- [ ] **Step 1: Add redirect config**

Replace `next.config.ts` with:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
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

export default nextConfig;
```

- [ ] **Step 2: Delete root page**

Remove `src/app/page.tsx`:

```bash
rm src/app/page.tsx
```

- [ ] **Step 3: Verify Next.js dev starts without errors**

Run: `npm run dev &`
Wait for `Ready` then stop.

Or just run `npx tsc --noEmit` to verify types.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git rm src/app/page.tsx
git commit -m "feat: redirect / to /movies permanently; remove unused root page"
```

---

### Task 5: Remove manual add movie route files

**Files:**
- Delete: `src/app/movies/new/page.tsx`
- Delete: `src/app/movies/new/MovieForm.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm src/app/movies/new/page.tsx
rm src/app/movies/new/MovieForm.tsx
```

- [ ] **Step 2: Commit**

```bash
git rm src/app/movies/new/page.tsx src/app/movies/new/MovieForm.tsx
git commit -m "chore: remove manual add movie route and form"
```

---

### Task 6: Nav cleanup + MovieCard image shrink

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/components/MovieCard.tsx`

- [ ] **Step 1: Remove "+ Add Movie" from nav**

In `src/app/layout.tsx`, remove the second nav link (`/movies/new`):

```tsx
            <nav className="flex gap-4">
              <Link
                href="/movies/import"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                + Import Movie
              </Link>
            </nav>
```

Then update the logo link to point to `/movies`:

```tsx
            <Link href="/movies" className="text-2xl font-bold text-gray-900 dark:text-white">
              MovieDB
            </Link>
```

- [ ] **Step 2: Shrink MovieCard poster**

In `src/app/components/MovieCard.tsx`, change line 18 from:

```tsx
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm bg-muted mb-2">
```

to:

```tsx
      <div className="relative aspect-[2/3] w-32 overflow-hidden rounded-sm bg-muted mb-2">
```

Also change the `sizes` attribute on the `<Image>` from:

```tsx
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
```

to:

```tsx
            sizes="128px"
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/components/MovieCard.tsx
git commit -m "style: shrink MovieCard posters; remove manual add nav link"
```

---

## Spec Coverage Review

| Spec Requirement | Task |
|------------------|------|
| Shrink `MovieCard` images by at least 60% | Task 6, Step 2 (`w-full` → `w-32`) |
| Make `/movies` the default page | Task 4 (`redirects` in `next.config.ts`) |
| Add ability to delete a movie from detail page | Task 1, 2, 3 (`deleteMovie` action + `DeleteMovieButton`) |
| Remove manual add movie route, view, controller | Task 5 (delete `/movies/new/*`) |
| Remove manual add movie nav link | Task 6, Step 1 (layout nav) |

No gaps found.

---

## Placeholder Scan

- No "TBD", "TODO", or "fill in" found.
- All steps contain exact code snippets or commands.
- Type names (`deleteMovie`, `DeleteMovieButton`, `idSchema`) are consistent across tasks.
