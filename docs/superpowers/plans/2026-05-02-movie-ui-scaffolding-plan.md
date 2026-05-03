# Movie UI Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a read-only movie listing and detail view in Next.js App Router with search and pagination.

**Architecture:** Use Next.js App Router with Server Components. Pages receive `searchParams` for pagination and search. Prisma queries the database directly in server components.

**Tech Stack:** Next.js 16, Prisma 5, PostgreSQL 16, Tailwind CSS

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `npx prisma db push`

- [ ] **Step 1: Update Prisma schema**

Replace the existing Movie model in `prisma/schema.prisma` with:

```prisma
model Movie {
  id           String   @id @default(uuid())
  tmdb_id      Int?     @unique
  title        String
  description  String?
  release_date Int?
  poster_path  String?
  vote_average Float?
  genres       String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

- [ ] **Step 2: Push schema to database**

Run: `npx prisma db push`

- [ ] **Step 3: Generate Prisma client**

Run: `npx prisma generate`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: update Movie model to match Rails schema"
```

---

### Task 2: Create MovieCard Component

**Files:**
- Create: `app/components/MovieCard.tsx`

- [ ] **Step 1: Create MovieCard component**

```tsx
import Link from 'next/link';
import { Movie } from '@prisma/client';

interface MovieCardProps {
  movie: Movie;
}

export function MovieCard({ movie }: MovieCardProps) {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : null;

  return (
    <Link
      href={`/movies/${movie.id}`}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden"
    >
      <div className="aspect-[2/3] relative bg-gray-200 dark:bg-gray-700">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={movie.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Poster
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
          {movie.title}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
          {movie.release_date && <span>{movie.release_date}</span>}
          {movie.vote_average && movie.vote_average > 0 && (
            <span className="inline-flex items-center">
              ★ {movie.vote_average.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/MovieCard.tsx
git commit -m "feat: add MovieCard component"
```

---

### Task 3: Create MovieGrid Component

**Files:**
- Create: `app/components/MovieGrid.tsx`

- [ ] **Step 1: Create MovieGrid component**

```tsx
import { Movie } from '@prisma/client';
import { MovieCard } from './MovieCard';

interface MovieGridProps {
  movies: Movie[];
}

export function MovieGrid({ movies }: MovieGridProps) {
  if (movies.length === 0) {
    return (
      <div className="col-span-full text-center py-16 text-gray-500 dark:text-gray-400">
        <p className="text-xl mb-4">No movies found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/MovieGrid.tsx
git commit -m "feat: add MovieGrid component"
```

---

### Task 4: Create SearchInput Component

**Files:**
- Create: `app/components/SearchInput.tsx`

- [ ] **Step 1: Create SearchInput component**

```tsx
'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

export function SearchInput({ defaultValue = '' }: { defaultValue?: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const [value, setValue] = useState(defaultValue);

  const handleSearch = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams);
      if (term) {
        params.set('q', term);
      } else {
        params.delete('q');
      }
      params.delete('page');
      replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, replace]
  );

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        handleSearch(e.target.value);
      }}
      placeholder="Search movies..."
      className="w-full md:w-96 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/SearchInput.tsx
git commit -m "feat: add SearchInput component"
```

---

### Task 5: Create Pagination Component

**Files:**
- Create: `app/components/Pagination.tsx`

- [ ] **Step 1: Create Pagination component**

```tsx
import Link from 'next/link';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;

  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    return `?${params.toString()}`;
  };

  return (
    <nav className="mt-8 flex justify-center gap-4">
      {currentPage > 1 && (
        <Link
          href={buildUrl(currentPage - 1)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Previous
        </Link>
      )}
      <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
        Page {currentPage} of {totalPages}
      </span>
      {currentPage < totalPages && (
        <Link
          href={buildUrl(currentPage + 1)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Next
        </Link>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/Pagination.tsx
git commit -m "feat: add Pagination component"
```

---

### Task 6: Create Movies List Page

**Files:**
- Create: `app/movies/page.tsx`

- [ ] **Step 1: Create movies list page**

First, ensure the lib/prisma exists:

```bash
ls lib/prisma.ts
```

If it doesn't exist, create it:

```tsx
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

Then create the page:

```tsx
import { prisma } from '@/lib/prisma';
import { MovieGrid } from '@/components/MovieGrid';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';

const PAGE_SIZE = 12;

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || '';
  const page = parseInt(params.page || '1', 10);
  const skip = (page - 1) * PAGE_SIZE;

  const where = query
    ? { title: { contains: query, mode: 'insensitive' as const } }
    : {};

  const [movies, total] = await Promise.all([
    prisma.movie.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.movie.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Movies
      </h1>

      <div className="mb-6">
        <SearchInput defaultValue={query} />
      </div>

      <MovieGrid movies={movies} />

      <Pagination currentPage={page} totalPages={totalPages} />
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/movies/page.tsx lib/prisma.ts
git commit -m "feat: add movies list page with search and pagination"
```

---

### Task 7: Create Movie Detail Page

**Files:**
- Create: `app/movies/[id]/page.tsx`

- [ ] **Step 1: Create movie detail page**

```tsx
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MoviePage({ params }: Props) {
  const { id } = await params;
  const movie = await prisma.movie.findUnique({ where: { id } });

  if (!movie) {
    notFound();
  }

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : null;

  const genres = movie.genres
    ? movie.genres.split(',').map((g) => g.trim())
    : [];

  return (
    <main className="container mx-auto px-4 py-8">
      <Link
        href="/movies"
        className="inline-block mb-6 text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        ← Back to movies
      </Link>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex-shrink-0">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={movie.title}
              className="rounded-lg shadow-lg w-full max-w-xs mx-auto md:mx-0"
            />
          ) : (
            <div className="w-full max-w-xs h-96 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400">
              No Poster
            </div>
          )}
        </div>

        <div className="flex-grow">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {movie.title}
          </h1>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {movie.vote_average && movie.vote_average > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                ★ {movie.vote_average.toFixed(1)}
              </span>
            )}

            {movie.release_date && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {movie.release_date}
              </span>
            )}
          </div>

          {genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {movie.description && (
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
              {movie.description}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/movies/[id]/page.tsx
git commit -m "feat: add movie detail page"
```

---

### Task 8: Verify Implementation

**Files:**
- Run dev server and test

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test the pages**

1. Visit http://localhost:3000/movies - should show movie grid (or empty state)
2. Test search - type a query, should filter movies
3. Test pagination - click next, URL should change to ?page=2
4. Click a movie - should navigate to detail page
5. Click back - should return to list

- [ ] **Step 3: Final commit if needed**

```bash
git add .
git commit -m "feat: complete movie UI scaffolding"
```