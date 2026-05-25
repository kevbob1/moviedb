# UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename routes, update navigation, restyle request cards with colored buttons and extra movie info, and make action buttons refresh the card state.

**Architecture:** Store extra movie fields (`release_date`, `overview`, `genre_ids`) in the DB on request creation. Use `revalidatePath('/requests')` in server actions so Next.js re-renders the server component after status transitions. Move `/search` to `/` and `/movies` to `/requests`.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma, PostgreSQL, Tailwind CSS, TypeScript, Jest, React Testing Library

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `prisma/schema.prisma` | DB schema | Add `release_date`, `overview`, `genre_ids` to `Request` model |
| `prisma/migrations/` | Migration files | Create new migration |
| `src/lib/request-service.ts` | Business logic | Update `createRequest` to accept new fields |
| `src/app/actions/request-actions.ts` | Server actions | Update `createRequest` signature; add `revalidatePath` to transitions |
| `src/app/page.tsx` | Landing page | Create from current `/search/page.tsx` content |
| `src/app/search/page.tsx` | Old search page | Delete |
| `src/app/requests/page.tsx` | Request list | Create from current `/movies/page.tsx`, remove search bar |
| `src/app/movies/page.tsx` | Old request list | Delete |
| `src/app/layout.tsx` | Root layout | Update nav, header, metadata |
| `src/components/RequestListItem.tsx` | Request card UI | Add year/description/genres; style buttons per action |
| `src/components/__tests__/RequestListItem.test.tsx` | Card tests | Update to assert new fields and button classes |
| `src/app/actions/__tests__/request-actions.test.ts` | Action tests | Update `createRequest` test; mock `revalidatePath` |

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to `Request` model**

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

- [ ] **Step 2: Generate migration**

Run:
```bash
npx prisma migrate dev --name add_movie_fields_to_requests
```

Expected output: Migration created successfully.

- [ ] **Step 3: Regenerate Prisma client**

Run:
```bash
npm run db:generate-client
```

Expected output: Client generated.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(db): add release_date, overview, genre_ids to requests"
```

---

### Task 2: Update Request Service

**Files:**
- Modify: `src/lib/request-service.ts`

- [ ] **Step 1: Update `CreateRequestInput` and `createRequest`**

```typescript
export interface CreateRequestInput {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  requestedBy: string;
  releaseDate?: string;
  overview?: string;
  genreIds?: number[];
}

export async function createRequest(input: CreateRequestInput) {
  if (!input.title?.trim() || !input.requestedBy?.trim()) {
    throw new Error('Title and requester name are required');
  }

  return prisma.request.create({
    data: {
      tmdb_id: input.tmdbId,
      title: input.title,
      poster_path: input.posterPath,
      requested_by: input.requestedBy,
      status: 'pending',
      media_type: 'movie',
      release_date: input.releaseDate,
      overview: input.overview,
      genre_ids: input.genreIds ?? [],
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/request-service.ts
git commit -m "feat(service): accept movie metadata in createRequest"
```

---

### Task 3: Update Request Actions

**Files:**
- Modify: `src/app/actions/request-actions.ts`

- [ ] **Step 1: Update `createRequest` signature and add `revalidatePath`**

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import {
  createRequest as createRequestImpl,
  fulfillRequest as fulfillRequestImpl,
  downloadRequest as downloadRequestImpl,
  cancelRequest as cancelRequestImpl,
} from '@/lib/request-service';

export async function createRequest(
  tmdbId: number,
  title: string,
  posterPath: string | null,
  requestedBy: string,
  releaseDate?: string,
  overview?: string,
  genreIds?: number[]
) {
  return createRequestImpl({
    tmdbId,
    title,
    posterPath,
    requestedBy,
    releaseDate,
    overview,
    genreIds,
  });
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

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/request-actions.ts
git commit -m "feat(actions): pass movie metadata to createRequest; revalidate /requests on transitions"
```

---

### Task 4: Update Search Page to Pass Movie Data

**Files:**
- Modify: `src/app/search/page.tsx`

- [ ] **Step 1: Update `handleRequest` to pass extra fields**

In the `handleRequest` function inside `src/app/search/page.tsx`, change the call to `createRequest`:

```typescript
const handleRequest = async (movie: TMDBMovie, requestedBy: string) => {
  try {
    await createRequest(
      movie.id,
      movie.title,
      movie.poster_path || null,
      requestedBy,
      movie.release_date,
      movie.overview,
      movie.genre_ids
    );
    setRequesting(null);
    // ... rest unchanged
  } catch (err) {
    console.error('Failed to create request:', err);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/app/search/page.tsx
git commit -m "feat(search): pass release_date, overview, genre_ids when creating request"
```

---

### Task 5: Move Search Page to Root (`/`)

**Files:**
- Create: `src/app/page.tsx`
- Delete: `src/app/search/page.tsx`

- [ ] **Step 1: Copy current `/search/page.tsx` to `/page.tsx`**

```bash
cp src/app/search/page.tsx src/app/page.tsx
```

- [ ] **Step 2: Update any hardcoded `/search` links in the new `page.tsx`**

Check the file for any references to `/search` and update them to `/`.

- [ ] **Step 3: Delete old `/search/page.tsx`**

```bash
rm src/app/search/page.tsx
rmdir src/app/search 2>/dev/null || true
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git rm -r src/app/search/
git commit -m "feat(routes): move search page to root /"
```

---

### Task 6: Rename `/movies` to `/requests`

**Files:**
- Create: `src/app/requests/page.tsx`
- Delete: `src/app/movies/page.tsx`

- [ ] **Step 1: Move page file**

```bash
mv src/app/movies/page.tsx src/app/requests/page.tsx
```

- [ ] **Step 2: Remove `<SearchInput>` from the page**

Edit `src/app/requests/page.tsx` to remove the import and usage of `SearchInput`:

Remove:
```typescript
import { SearchInput } from '@/app/components/SearchInput';
```

And remove the div wrapping `<SearchInput>`:
```tsx
<div className="mb-6">
  <SearchInput defaultValue={query} />
</div>
```

Also remove unused `query` variable and the `...(query && { title: ... })` filter block since searching is removed. Keep `showFulfilled` filtering.

Refactored `where`:
```typescript
const where = {
  status: showFulfilled
    ? { notIn: ['canceled'] }
    : { notIn: ['fulfilled', 'canceled'] },
};
```

Remove `q` from `searchParams` type and `preserveParams`.

- [ ] **Step 3: Commit**

```bash
git add src/app/requests/page.tsx
git rm -r src/app/movies/
git commit -m "feat(routes): rename /movies to /requests, remove search bar"
```

---

### Task 7: Update Layout Navigation

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace header/nav content**

```tsx
import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Is It On Jellyfin?',
  description: 'Check if movies are available and request new ones',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-gray-200 dark:border-gray-800">
          <div className="container mx-auto px-4 py-6 flex justify-between items-center">
            <Link
              href="/"
              className="text-3xl font-bold text-gray-900 dark:text-white hover:opacity-80 transition-opacity"
            >
              Is It On Jellyfin?
            </Link>
            <nav>
              <Link
                href="/requests"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                View Requests
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(layout): centered Is It On Jellyfin? header, add View Requests link"
```

---

### Task 8: Update RequestListItem with New Fields and Styled Buttons

**Files:**
- Modify: `src/components/RequestListItem.tsx`

- [ ] **Step 1: Add action-to-color mapping**

```typescript
const ACTION_STYLES: Record<string, string> = {
  download: 'bg-blue-600 hover:bg-blue-700',
  fulfill: 'bg-green-600 hover:bg-green-700',
  cancel: 'bg-red-600 hover:bg-red-700',
};
```

- [ ] **Step 2: Update card layout and button classes**

Inside the return, update the button mapping:

```tsx
<div className="flex gap-2 mt-2">
  {actions.map((action) => {
    const handleClick =
      action.action === 'fulfill'
        ? handleMarkFulfilled
        : action.action === 'download'
        ? handleDownload
        : action.action === 'cancel'
        ? handleCancel
        : undefined;

    const colorClass = ACTION_STYLES[action.action] || 'bg-primary hover:opacity-90';

    return (
      <button
        key={action.action}
        onClick={(e) => {
          e.preventDefault();
          handleClick?.();
        }}
        disabled={isLoading}
        className={`px-3 py-1 text-sm text-white rounded disabled:opacity-50 ${colorClass}`}
      >
        {isLoading ? 'Loading...' : action.label}
      </button>
    );
  })}
</div>
```

- [ ] **Step 3: Reorder card content to show year, description, genres**

Update the content area (inside `<div className="flex-1">`) to:

```tsx
<div className="flex-1">
  <div className="flex items-center gap-2 mb-1">
    <h3 className="font-semibold">
      {request.title}
      {request.release_date && (
        <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
          ({request.release_date.split('-')[0]})
        </span>
      )}
    </h3>
    <span className={`px-2 py-0.5 text-xs rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
      {statusConfig.label}
    </span>
  </div>

  {request.overview && (
    <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
      {request.overview}
    </p>
  )}

  {request.genre_ids && request.genre_ids.length > 0 && (
    <div className="text-sm text-muted-foreground mb-1">
      {getGenreNames(request.genre_ids).join(', ')}
    </div>
  )}

  <p className="text-sm text-muted-foreground mb-2">
    Requested by {request.requested_by} • {new Date(request.requested_at).toLocaleDateString()}
  </p>

  {/* action buttons from Step 2 */}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/RequestListItem.tsx
git commit -m "feat(request-card): add year, description, genres; style action buttons by type"
```

---

### Task 9: Update RequestListItem Tests

**Files:**
- Modify: `src/components/__tests__/RequestListItem.test.tsx`

- [ ] **Step 1: Update mock data with new fields**

The existing mock already has `overview`, `release_date`, `genre_ids`, and `tmdb_id` — no change needed for data shape.

- [ ] **Step 2: Add tests for new fields**

Add after existing tests:

```typescript
  it('renders release year next to title', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it('renders overview description', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    expect(screen.getByText('A test movie')).toBeInTheDocument();
  });

  it('renders genres from genre_ids', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    expect(screen.getByText('Action, Adventure')).toBeInTheDocument();
  });
```

- [ ] **Step 3: Add test for button colors**

```typescript
  it('renders cancel button in red', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toHaveClass('bg-red-600');
  });

  it('renders start download button in blue', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    const downloadButton = screen.getByText('Start Download');
    expect(downloadButton).toHaveClass('bg-blue-600');
  });

  it('renders mark fulfilled button in green', () => {
    render(<RequestListItem request={mockRequest} jellyfinAvailable={false} />);
    const fulfillButton = screen.getByText('Mark Fulfilled');
    expect(fulfillButton).toHaveClass('bg-green-600');
  });
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/components/__tests__/RequestListItem.test.tsx
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/__tests__/RequestListItem.test.tsx
git commit -m "test(RequestListItem): assert year, description, genres, and button colors"
```

---

### Task 10: Update Action Tests

**Files:**
- Modify: `src/app/actions/__tests__/request-actions.test.ts`

- [ ] **Step 1: Mock `next/cache`**

Add at the top of the test file (after imports):

```typescript
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));
```

- [ ] **Step 2: Import the mock**

```typescript
import { revalidatePath } from 'next/cache';
```

- [ ] **Step 3: Assert `revalidatePath` is called in transition tests**

Add assertions in `fulfillRequest`, `downloadRequest`, and `cancelRequest` test blocks after the existing expectations:

For `fulfillRequest`:
```typescript
expect(revalidatePath).toHaveBeenCalledWith('/requests');
```

Same for `downloadRequest` and `cancelRequest`.

- [ ] **Step 4: Update `createRequest` test to include new fields**

Update the `it('creates a request with pending status')` test to pass the new optional arguments and assert they are included in the `prisma.request.create` call:

```typescript
    it('creates a request with pending status and extra fields', async () => {
      const mockRequest = { id: 1, title: 'Test Movie', status: 'pending' };
      (prisma.request.create as jest.Mock).mockResolvedValue(mockRequest);

      const result = await createRequest(123, 'Test Movie', '/path.jpg', 'John Doe', '2024-01-01', 'A movie', [28, 12]);

      expect(prisma.request.create).toHaveBeenCalledWith({
        data: {
          tmdb_id: 123,
          title: 'Test Movie',
          poster_path: '/path.jpg',
          requested_by: 'John Doe',
          status: 'pending',
          media_type: 'movie',
          release_date: '2024-01-01',
          overview: 'A movie',
          genre_ids: [28, 12],
        },
      });
      expect(result).toEqual(mockRequest);
    });
```

- [ ] **Step 5: Run tests**

```bash
npm test -- src/app/actions/__tests__/request-actions.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/__tests__/request-actions.test.ts
git commit -m "test(request-actions): assert revalidatePath and new createRequest fields"
```

---

### Task 11: Final Validation

- [ ] **Step 1: Run full validation suite**

```bash
npm run check
```

Expected output: All checks pass (db:generate-client, lint, test, typecheck, build).

- [ ] **Step 2: Fix any failures**

If lint or typecheck fails, fix the issues in the relevant files and re-run.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: final validation fixes"
```

---

## Self-Review Checklist

- [ ] **Spec coverage**: Every goal from the spec has a task.
- [ ] **Placeholder scan**: No TBD, TODO, or vague instructions.
- [ ] **Type consistency**: `createRequest` signature is consistent across service, actions, and tests.
- [ ] **Route coverage**: `/` (search), `/requests` (list), old routes removed.
