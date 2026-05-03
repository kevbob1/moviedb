# Movie UI Scaffolding Design

## Overview
Scaffold a read-only movie listing and detail view in Next.js App Router, mirroring the legacy Rails UI functionality. Include search and pagination.

## Tech Stack
- Next.js 16 (App Router)
- Prisma 5
- PostgreSQL 16
- Tailwind CSS (already configured)

## Database

### Prisma Schema Update
Update `prisma/schema.prisma` to match the Rails Movie model:

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

Run `npx prisma db push` to sync the schema to the database.

## Pages

### 1. Movie List Page (`app/movies/page.tsx`)
- **Route**: `/movies`
- **Layout**:
  - Heading: "Movies"
  - Search input (text field, searches by title)
  - Movie grid (responsive: 1 col mobile, 2 col sm, 3 col lg, 4 col xl)
  - Pagination controls (prev/next)
- **Data Fetching**:
  - Server Component
  - Read `searchParams.q` for search query
  - Read `searchParams.page` for pagination (default: 1)
  - Page size: 12 movies
  - Prisma query: `movie.findMany({ where: { title: { contains: q, mode: 'insensitive' } }, orderBy: { createdAt: 'desc' }, skip: (page-1)*12, take: 12 })`

### 2. Movie Detail Page (`app/movies/[id]/page.tsx`)
- **Route**: `/movies/[id]`
- **Layout**:
  - Back link to list
  - Poster image (or placeholder if missing)
  - Title (h1)
  - Rating badge (if vote_average > 0)
  - Release year
  - Genre tags
  - Description
- **Data Fetching**:
  - Server Component
  - Fetch movie by ID from params
  - 404 if not found

## Components

### `MovieCard` (`app/components/MovieCard.tsx`)
- Props: `movie: Movie`
- Display: poster, title, year, rating
- Links to detail page

### `MovieGrid` (`app/components/MovieGrid.tsx`)
- Props: `movies: Movie[]`
- Renders grid of MovieCard components

### `SearchInput` (`app/components/SearchInput.tsx`)
- Props: `defaultValue: string`
- Form with GET to `/movies?q=...`
- Uses URLSearchParams for client-side navigation

### `Pagination` (`app/components/Pagination.tsx`)
- Props: `currentPage: number, totalPages: number, baseUrl: string`
- Renders Prev/Next buttons
- Disabled state when not applicable

## Routing
- Use Next.js App Router file-based routing
- Dynamic route segment for `[id]`
- URL structure: `/movies?page=2&q=star`

## Error Handling
- Return `notFound()` from `app/movies/[id]/page.tsx` if movie doesn't exist
- Show "No movies found" message on empty list

## Acceptance Criteria
1. `/movies` displays all movies in a responsive grid
2. Search input filters movies by title (case-insensitive)
3. Pagination works with prev/next buttons
4. Clicking a movie navigates to `/movies/[id]`
5. Detail page shows all movie fields (poster, title, rating, year, genres, description)
6. Back link returns to list
7. 404 shown for invalid movie ID
8. Empty state shows "No movies found" message