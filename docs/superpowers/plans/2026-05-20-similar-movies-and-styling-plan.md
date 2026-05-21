# Similar Movies and Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the UI to a clean, minimalist style and add a TMDB-powered Similar Movies section to the movie detail page.

**Architecture:** We will strip out excessive Tailwind styling for a minimalist look, implement a server-side TMDB API integration to fetch similar movies, and display them in a clean grid at the bottom of the movie page.

**Tech Stack:** Next.js Server Components, Tailwind CSS, TMDB API.

---

### Task 1: Clean Up Global Styling & "AI Chrome"

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/button.tsx` (if applicable, generic UI cleanup)

- [ ] **Step 1: Simplify Global CSS**
Update `src/app/globals.css` to ensure a stark background and remove unnecessary variables related to excessive borders/shadows if any.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
  }

  .dark {
    --background: 0 0% 9%;
    --foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
  }
}

body {
  @apply bg-background text-foreground;
}
```

- [ ] **Step 2: Check standard UI elements**
Run a quick global search for `rounded-xl`, `rounded-2xl`, `shadow-lg`, `shadow-xl`, `bg-gradient-to` and replace them with simpler styles like `rounded-sm` or `shadow-sm` where feasible.
Run: `grep -r "rounded-[x2]l\|shadow-[lx]g\|bg-gradient" src/`

- [ ] **Step 3: Commit styling foundation**
```bash
git add src/app/globals.css
git commit -m "style: establish minimalist foundation, remove ai chrome"
```

### Task 2: Redesign the `MovieCard` Component

**Files:**
- Modify: `src/components/MovieCard.tsx` (or equivalent file)

- [ ] **Step 1: Rewrite MovieCard for minimalism**
Strip out any card borders or heavy styling. Emphasize the poster.

```tsx
import Image from "next/image";
import Link from "next/link";

interface MovieCardProps {
  id: string | number;
  title: string;
  posterUrl: string | null;
  year?: string | number;
}

export function MovieCard({ id, title, posterUrl, year }: MovieCardProps) {
  return (
    <Link href={`/movie/${id}`} className="block group w-full">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-sm bg-muted mb-2">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm p-4 text-center">
            No Image
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <h3 className="font-semibold text-sm leading-tight line-clamp-1">{title}</h3>
        {year && <span className="text-xs text-muted-foreground mt-0.5">{year}</span>}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit MovieCard redesign**
```bash
git add src/components/MovieCard.tsx
git commit -m "style: redesign MovieCard for minimalist aesthetic"
```

### Task 3: Build TMDB Service

**Files:**
- Create: `src/lib/tmdb.ts`

- [ ] **Step 1: Write TMDB fetching logic**

```typescript
// src/lib/tmdb.ts
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN || "";
const BASE_URL = "https://api.themoviedb.org/3";

export interface TMDBSimilarMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
}

export async function getSimilarMovies(tmdbId: number): Promise<TMDBSimilarMovie[]> {
  if (!TMDB_ACCESS_TOKEN) {
    console.warn("Missing TMDB_ACCESS_TOKEN. Cannot fetch similar movies.");
    return [];
  }

  try {
    const res = await fetch(
      `${BASE_URL}/movie/${tmdbId}/similar?language=en-US&page=1`,
      {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`
        },
        next: { revalidate: 86400 } // Cache for 24 hours
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch similar movies: ${res.statusText}`);
    }

    const data = await res.json();
    return data.results || [];
  } catch (error) {
    console.error("Error fetching similar movies:", error);
    return [];
  }
}
```

- [ ] **Step 2: Commit TMDB Service**
```bash
git add src/lib/tmdb.ts
git commit -m "feat: add tmdb service for fetching similar movies"
```

### Task 4: Build `SimilarMovies` Component

**Files:**
- Create: `src/components/SimilarMovies.tsx`

- [ ] **Step 1: Write SimilarMovies Component**

```tsx
// src/components/SimilarMovies.tsx
import { getSimilarMovies } from "@/lib/tmdb";
import { MovieCard } from "./MovieCard";

interface SimilarMoviesProps {
  tmdbId: number | null;
}

export async function SimilarMovies({ tmdbId }: SimilarMoviesProps) {
  if (!tmdbId) return null;

  const movies = await getSimilarMovies(tmdbId);
  
  if (!movies || movies.length === 0) return null;

  const displayMovies = movies.slice(0, 6); // Show top 6

  return (
    <section className="mt-16 border-t pt-8">
      <h2 className="text-xl font-bold mb-6">Similar Movies</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {displayMovies.map((movie) => (
          <MovieCard
            key={movie.id}
            id={movie.id} // Note: This routes to TMDB ID. In a full implementation, we'd map to local ID if exists.
            title={movie.title}
            year={movie.release_date?.split('-')[0]}
            posterUrl={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit SimilarMovies Component**
```bash
git add src/components/SimilarMovies.tsx
git commit -m "feat: build SimilarMovies ui component"
```

### Task 5: Integrate into Movie Detail Page

**Files:**
- Modify: `src/app/movie/[id]/page.tsx` (or the equivalent dynamic movie page route)

- [ ] **Step 1: Check existing movie page location**
Run: `ls src/app/movie` or similar to locate the exact page file.

- [ ] **Step 2: Add component to the page**
Update the relevant movie page.tsx to import and use the component at the bottom of the layout.

```tsx
// inside src/app/movie/[id]/page.tsx (conceptual addition)
import { SimilarMovies } from "@/components/SimilarMovies";

// ... existing component code ...
export default async function MoviePage({ params }: { params: { id: string } }) {
  // ... fetch existing movie data ...
  // Assume movie object has `tmdbId`
  
  return (
    <main className="container mx-auto px-4 py-8">
      {/* existing movie details UI */}
      
      {/* NEW COMPONENT ADDED HERE */}
      <SimilarMovies tmdbId={movie.tmdbId} />
    </main>
  );
}
```

- [ ] **Step 3: Commit integration**
```bash
git add src/app/movie/[id]/page.tsx
git commit -m "feat: integrate SimilarMovies into movie detail page"
```
