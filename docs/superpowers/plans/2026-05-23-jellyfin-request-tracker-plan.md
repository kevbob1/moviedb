# Jellyfin Request Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Movie model with a Request tracker that integrates with Jellyfin for content availability checks.

**Architecture:** Server-side Jellyfin checks via a new `lib/jellyfin.ts` module, Request model replaces Movie model, UI components rebuilt for the new request workflow, live availability checks on every render.

**Tech Stack:** Next.js, Prisma, React Server Components, TypeScript, Jellyfin Items API

---

### Task 1: Create Jest test setup for Jellyfin library

**Files:**
- Create: `src/lib/__tests__/jellyfin.test.ts`

- [ ] **Step 1: Write failing tests for Jellyfin library behavior**

```typescript
// src/lib/__tests__/jellyfin.test.ts

describe('Jellyfin library', () => {
  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.JELLYFIN_URL;
    delete process.env.JELLYFIN_API_KEY;
  });

  describe('isMovieOnJellyfin', () => {
    it('returns false when JELLYFIN_URL is missing', async () => {
      process.env.JELLYFIN_API_KEY = 'test-key';
      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('returns false when JELLYFIN_API_KEY is missing', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('queries correctly formed URL with TMDB ID', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';
      const mockFetch = jest.spyOn(global, 'fetch') as jest.Mock;

      await isMovieOnJellyfin(123);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8096/Items?AnyProviderIdEquals=tmdb.123&IncludeItemTypes=Movie',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'MediaBrowser Token="test-key"'
          })
        })
      );
    });

    it('returns true when Jellyfin returns results', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Items: [
            { id: '1', Name: 'Test Movie', ProviderIds: { tmdb: '123' } }
          ]
        })
      });

      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(true);
    });

    it('returns false when Jellyfin returns empty results', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Items: [] })
      });

      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });

    it('returns false on non-2xx response', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await isMovieOnJellyfin(123);
      expect(result).toBe(false);
    });
  });

  describe('areMoviesOnJellyfin', () => {
    it('returns empty map when no IDs provided', async () => {
      const result = await areMoviesOnJellyfin([]);
      expect(result).toEqual(new Map());
    });

    it('makes single call for multiple IDs and returns map', async () => {
      process.env.JELLYFIN_URL = 'http://localhost:8096';
      process.env.JELLYFIN_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Items: [
            { id: '1', ProviderIds: { tmdb: '123' } },
            { id: '2', ProviderIds: { tmdb: '456' } }
          ]
        })
      });

      const result = await areMoviesOnJellyfin([123, 456, 789]);
      expect(result.get(123)).toBe(true);
      expect(result.get(456)).toBe(true);
      expect(result.get(789)).toBe(false);
    });

    it('returns false for all IDs when JELLYFIN_URL is missing', async () => {
      const result = await areMoviesOnJellyfin([123, 456]);
      expect(result.get(123)).toBe(false);
      expect(result.get(456)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails (module not defined)**

Run: `npm test -- src/lib/__tests__/jellyfin.test.ts`
Expected: FAIL with "Cannot find name 'isMovieOnJellyfin'" etc.

- [ ] **Step 3: Commit test stub**

Run:
```bash
git add src/lib/__tests__/jellyfin.test.ts
git commit -m "test: add failing tests for Jellyfin library"
```

---

### Task 2: Create Jellyfin library implementation

**Files:**
- Create: `src/lib/jellyfin.ts`

- [ ] **Step 1: Implement isMovieOnJellyfin**

```typescript
// src/lib/jellyfin.ts

const JELLYFIN_URL = process.env.JELLYFIN_URL || "";
const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY || "";

async function queryJellyfinItems(endpoint: string): Promise<any | null> {
  if (!JELLYFIN_URL || !JELLYFIN_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${JELLYFIN_URL}${endpoint}`, {
      headers: {
        'Authorization': `MediaBrowser Token="${JELLYFIN_API_KEY}"`
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

export async function isMovieOnJellyfin(tmdbId: number): Promise<boolean> {
  if (!tmdbId) {
    return false;
  }

  const data = await queryJellyfinItems(
    `/Items?AnyProviderIdEquals=tmdb.${tmdbId}&IncludeItemTypes=Movie`
  );

  return data?.Items?.length > 0 || false;
}

export async function areMoviesOnJellyfin(tmdbIds: number[]): Promise<Map<number, boolean>> {
  const result = new Map<number, boolean>();

  if (!tmdbIds?.length) {
    return result;
  }

  // Initialize all as false
  tmdbIds.forEach(id => result.set(id, false));

  if (!JELLYFIN_URL || !JELLYFIN_API_KEY) {
    return result;
  }

  // Build provider filter: tmdb.123|tmdb.456|tmdb.789
  const anyProviderIdEquals = tmdbIds.map(id => `tmdb.${id}`).join('|');

  const data = await queryJellyfinItems(
    `/Items?AnyProviderIdEquals=${anyProviderIdEquals}&IncludeItemTypes=Movie`
  );

  if (data?.Items?.length > 0) {
    data.Items.forEach((item: any) => {
      const tmdbId = item.ProviderIds?.tmdb;
      if (tmdbId && result.has(parseInt(tmdbId, 10))) {
        result.set(parseInt(tmdbId, 10), true);
      }
    });
  }

  return result;
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/jellyfin.test.ts`
Expected: PASS all tests

- [ ] **Step 3: Commit**

Run:
```bash
git add src/lib/jellyfin.ts
git commit -m "feat: implement Jellyfin library"
```

---

### Task 3: Add Prisma migration to replace Movie model with Request model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update schema**

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
  output        = "../src/generated/prisma"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

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

- [ ] **Step 2: Generate migration**

Run:
```bash
npx prisma migrate dev --name switch_to_requests
```
Expected: Creates migration SQL dropping `movies` table, creating `requests` table

- [ ] **Step 3: Regenerate Prisma client**

Run:
```bash
npx prisma generate
```
Expected: Regenerates client in `src/generated/prisma/`

- [ ] **Step 4: Commit schema and migration changes**

Run:
```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "refactor: replace Movie model with Request model"
```

---

### Task 4: Create JellyfinBadge component

**Files:**
- Create: `src/components/JellyfinBadge.tsx`
- Create: `src/components/__tests__/JellyfinBadge.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// src/components/__tests__/JellyfinBadge.test.tsx

import { render, screen } from '@testing-library/react';
import { JellyfinBadge } from '../JellyfinBadge';

describe('JellyfinBadge', () => {
  it('shows "On Jellyfin" when available is true', () => {
    render(<JellyfinBadge available={true} />);
    expect(screen.getByText('On Jellyfin')).toBeInTheDocument();
  });

  it('renders nothing when available is false', () => {
    const { container } = render(<JellyfinBadge available={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/JellyfinBadge.test.tsx`
Expected: FAIL with "Cannot find module '../JellyfinBadge'"

- [ ] **Step 3: Implement JellyfinBadge**

```typescript
// src/components/JellyfinBadge.tsx

interface Props {
  available: boolean;
}

export function JellyfinBadge({ available }: Props) {
  if (!available) {
    return null;
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
      On Jellyfin
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/__tests__/JellyfinBadge.test.tsx`
Expected: PASS all tests

- [ ] **Step 5: Commit**

Run:
```bash
git add src/components/JellyfinBadge.tsx src/components/__tests__/JellyfinBadge.test.tsx
git commit -m "feat: add JellyfinBadge component"
```

---

### Task 5: Create RequestCard component

**Files:**
- Create: `src/components/RequestCard.tsx`
- Create: `src/components/__tests__/RequestCard.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// src/components/__tests__/RequestCard.test.tsx

import { render, screen } from '@testing-library/react';
import { RequestCard } from '../RequestCard';

describe('RequestCard', () => {
  const mockRequest = {
    id: 1,
    title: 'Test Movie',
    tmdb_id: 123,
    poster_path: '/test.jpg',
    requested_at: new Date('2026-05-23'),
    requested_by: 'Alice',
    status: 'pending',
    media_type: 'movie'
  };

  it('renders request title', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => false} onFulfill={() => {}} />);
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
  });

  it('shows requester and date', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => false} onFulfill={() => {}} />);
    expect(screen.getByText(/requested by:/i)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows status badge', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => false} onFulfill={() => {}} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows Jellyfin badge when available', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => true} onFulfill={() => {}} />);
    expect(screen.getByText('On Jellyfin')).toBeInTheDocument();
  });

  it('does not show Jellyfin badge when not available', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => false} onFulfill={() => {}} />);
    expect(screen.queryByText('On Jellyfin')).not.toBeInTheDocument();
  });

  it('shows mark fulfilled button', () => {
    render(<RequestCard request={mockRequest} onJellyfin={() => false} onFulfill={() => {}} />);
    expect(screen.getByRole('button', { name: /mark fulfilled/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/RequestCard.test.tsx`
Expected: FAIL with module not found

- [ ] **Step 3: Implement RequestCard**

```typescript
// src/components/RequestCard.tsx

'use client';

import Image from 'next/image';
import { JellyfinBadge } from './JellyfinBadge';

interface Request {
  id: number;
  title: string;
  tmdb_id: number | null;
  poster_path: string | null;
  requested_at: Date;
  requested_by: string;
  status: 'pending' | 'downloading' | 'fulfilled';
  media_type: string;
}

interface Props {
  request: Request;
  onJellyfin: (tmdbId: number | null) => boolean;
  onFulfill: (requestId: number) => void;
}

export function RequestCard({ request, onJellyfin, onFulfill }: Props) {
  const posterUrl = request.poster_path
    ? `https://image.tmdb.org/t/p/w342${request.poster_path}`
    : null;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    downloading: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    fulfilled: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  };

  const jellyfinAvailable = onJellyfin(request.tmdb_id);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-sm shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex gap-4">
          {posterUrl ? (
            <div className="flex-shrink-0">
              <Image
                src={posterUrl}
                alt={request.title}
                width={120}
                height={180}
                className="rounded-sm"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-[120px] h-[180px] bg-gray-200 dark:bg-gray-700 rounded-sm flex items-center justify-center">
              No Poster
            </div>
          )}

          <div className="flex-grow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {request.title}
            </h3>

            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${statusColors[request.status]}`}>
                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </span>

              {jellyfinAvailable && (
                <JellyfinBadge available={true} />
              )}
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              <p>Requested by: <span className="font-medium text-gray-900 dark:text-white">{request.requested_by}</span></p>
              <p>On: {formatDate(request.requested_at)}</p>
            </div>

            {request.status !== 'fulfilled' && (
              <button
                onClick={() => onFulfill(request.id)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
              >
                Mark Fulfilled
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/__tests__/RequestCard.test.tsx`
Expected: PASS all tests

- [ ] **Step 5: Commit**

Run:
```bash
git add src/components/RequestCard.tsx src/components/__tests__/RequestCard.test.tsx
git commit -m "feat: add RequestCard component"
```

---

### Task 6: Create RequestGrid component

**Files:**
- Create: `src/components/RequestGrid.tsx`
- Create: `src/components/__tests__/RequestGrid.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// src/components/__tests__/RequestGrid.test.tsx

import { render, screen } from '@testing-library/react';
import { RequestGrid } from '../RequestGrid';

describe('RequestGrid', () => {
  const mockRequests = [
    { id: 1, title: 'Movie 1', tmdb_id: 123, poster_path: '/1.jpg', requested_at: new Date(), requested_by: 'Alice', status: 'pending', media_type: 'movie' },
    { id: 2, title: 'Movie 2', tmdb_id: 456, poster_path: '/2.jpg', requested_at: new Date(), requested_by: 'Bob', status: 'downloading', media_type: 'movie' }
  ];

  it('renders all requests', () => {
    render(
      <RequestGrid
        requests={mockRequests}
        onJellyfin={() => false}
        onFulfill={() => {}}
      />
    );
    expect(screen.getByText('Movie 1')).toBeInTheDocument();
    expect(screen.getByText('Movie 2')).toBeInTheDocument();
  });

  it('renders empty state when no requests', () => {
    render(
      <RequestGrid
        requests={[]}
        onJellyfin={() => false}
        onFulfill={() => {}}
      />
    );
    expect(screen.getByText(/no requests/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/__tests__/RequestGrid.test.tsx`
Expected: FAIL with module not found

- [ ] **Step 3: Implement RequestGrid**

```typescript
// src/components/RequestGrid.tsx

import { RequestCard } from './RequestCard';

interface Request {
  id: number;
  title: string;
  tmdb_id: number | null;
  poster_path: string | null;
  requested_at: Date;
  requested_by: string;
  status: 'pending' | 'downloading' | 'fulfilled';
  media_type: string;
}

interface Props {
  requests: Request[];
  onJellyfin: (tmdbId: number | null) => boolean;
  onFulfill: (requestId: number) => void;
}

export function RequestGrid({ requests, onJellyfin, onFulfill }: Props) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No requests yet
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {requests.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          onJellyfin={onJellyfin}
          onFulfill={onFulfill}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/__tests__/RequestGrid.test.tsx`
Expected: PASS all tests

- [ ] **Step 5: Commit**

Run:
```bash
git add src/components/RequestGrid.tsx src/components/__tests__/RequestGrid.test.tsx
git commit -m "feat: add RequestGrid component"
```

---

### Task 7: Create RequestForm component

**Files:**
- Create: `src/components/RequestForm.tsx`

- [ ] **Step 1: Implement RequestForm**

```typescript
// src/components/RequestForm.tsx

'use client';

import { useState } from 'react';

interface Props {
  onSubmit: (requestedBy: string) => void;
  onCancel: () => void;
  isVisible: boolean;
}

export function RequestForm({ onSubmit, onCancel, isVisible }: Props) {
  const [requestedBy, setRequestedBy] = useState('');

  if (!isVisible) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestedBy.trim()) {
      onSubmit(requestedBy.trim());
      setRequestedBy('');
    }
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-sm p-4 mt-3">
      <form onSubmit={handleSubmit}>
        <label htmlFor="requestedBy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Requested by (your name):
        </label>
        <input
          id="requestedBy"
          type="text"
          value={requestedBy}
          onChange={(e) => setRequestedBy(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          placeholder="Your name"
          required
        />

        <div className="flex gap-2 mt-3">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-sm hover:bg-blue-700"
          >
            Submit Request
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-sm hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/components/RequestForm.tsx
git commit -m "feat: add RequestForm component"
```

---

### Task 8: Create server action for creating requests

**Files:**
- Create: `src/app/actions/request-actions.ts`
- Create: `src/app/actions/__tests__/request-actions.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/app/actions/__tests__/request-actions.test.ts

import { createRequest } from '../request-actions';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma');

describe('request-actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('creates a request and returns it', async () => {
      const mockRequest = {
        id: 1,
        title: 'Test Movie',
        tmdb_id: 123,
        poster_path: '/test.jpg',
        status: 'pending',
        media_type: 'movie',
        requested_at: new Date(),
        requested_by: 'Alice'
      };

      (prisma.request.create as jest.Mock).mockResolvedValue(mockRequest);

      const result = await createRequest(123, 'Test Movie', '/test.jpg', 'Alice');

      expect(result).toEqual(mockRequest);
      expect(prisma.request.create).toHaveBeenCalledWith({
        data: {
          tmdb_id: 123,
          title: 'Test Movie',
          poster_path: '/test.jpg',
          requested_by: 'Alice',
          status: 'pending',
          media_type: 'movie'
        }
      });
    });

    it('throws error on failure', async () => {
      (prisma.request.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(createRequest(123, 'Test', '/test.jpg', 'Alice')).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/actions/__tests__/request-actions.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement server action**

```typescript
// src/app/actions/request-actions.ts

'use server';

import { prisma } from '@/lib/prisma';

export async function createRequest(
  tmdbId: number | null,
  title: string,
  posterPath: string | null,
  requestedBy: string
) {
  if (!title?.trim() || !requestedBy?.trim()) {
    throw new Error('Title and requested_by are required');
  }

  return prisma.request.create({
    data: {
      tmdb_id: tmdbId,
      title,
      poster_path: posterPath,
      requested_by: requestedBy,
      status: 'pending',
      media_type: 'movie'
    }
  });
}

export async function fulfillRequest(requestId: number) {
  return prisma.request.update({
    where: { id: requestId },
    data: { status: 'fulfilled' }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/actions/__tests__/request-actions.test.ts`
Expected: PASS all tests

- [ ] **Step 5: Commit**

Run:
```bash
git add src/app/actions/request-actions.ts src/app/actions/__tests__/request-actions.test.ts
git commit -m "feat: add request server actions"
```

---

### Task 9: Rewrite /movies page to show requests

**Files:**
- Modify: `src/app/movies/page.tsx`

- [ ] **Step 1: Rewrite movies page**

```typescript
// src/app/movies/page.tsx

import { prisma } from '@/lib/prisma';
import { RequestGrid } from '@/components/RequestGrid';
import { SearchInput } from '@/app/components/SearchInput';
import { Pagination } from '@/app/components/Pagination';
import { areMoviesOnJellyfin } from '@/lib/jellyfin';

const PAGE_SIZE = 12;

export default async function RequestsPage({
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

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { requested_at: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.request.count({ where }),
  ]);

  const tmdbIds = requests.map(r => r.tmdb_id).filter((id): id is number => id !== null);
  const jellyfinAvailability = await areMoviesOnJellyfin(tmdbIds);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Requests
      </h1>

      <div className="mb-6">
        <SearchInput defaultValue={query} />
      </div>

      <RequestGrid
        requests={requests}
        onJellyfin={(tmdbId) => jellyfinAvailability.get(tmdbId || 0) || false}
      />

      <Pagination currentPage={page} totalPages={totalPages} />
    </main>
  );
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/app/movies/page.tsx
git commit -m "feat: rewrite /movies to show requests"
```

---

### Task 10: Rewrite /movies/import page with Jellyfin integration

**Files:**
- Modify: `src/app/movies/import/page.tsx` (or create if not existing)

- [ ] **Step 1: Rewrite import page**

```typescript
// src/app/movies/import/page.tsx

'use client';

import { useState } from 'react';
import { searchTMDBMovies, TMDBMovie } from '@/lib/tmdb';
import { isMovieOnJellyfin } from '@/lib/jellyfin';
import { createRequest } from '@/app/actions/request-actions';
import { RequestForm } from '@/components/RequestForm';
import { JellyfinBadge } from '@/components/JellyfinBadge';

export default function ImportPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [jellyfinStatus, setJellyfinStatus] = useState<Map<number, boolean>>(new Map());
  const [requesting, setRequesting] = useState<number | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const movies = await searchTMDBMovies(query);
      setResults(movies);

      // Check Jellyfin availability for all results
      const jellyfinChecks = await Promise.all(
        movies.map(async (movie) => ({
          id: movie.id,
          available: await isMovieOnJellyfin(movie.id)
        }))
      );

      setJellyfinStatus(new Map(jellyfinChecks.map(c => [c.id, c.available])));
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (movie: TMDBMovie, requestedBy: string) => {
    try {
      await createRequest(movie.id, movie.title, movie.poster_path || null, requestedBy);
      setRequesting(null);

      // Refresh jellyfin status after creating request
      if (movie.id) {
        const available = await isMovieOnJellyfin(movie.id);
        setJellyfinStatus(prev => new Map(prev).set(movie.id, available));
      }
    } catch (error) {
      console.error('Failed to create request:', error);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Request a Movie
      </h1>

      <form onSubmit={handleSearch} className="mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a movie..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {results.map((movie) => {
          const onJellyfin = jellyfinStatus.get(movie.id) || false;
          const isRequesting = requesting === movie.id;

          return (
            <div
              key={movie.id}
              className="bg-white dark:bg-gray-800 rounded-sm shadow-sm p-4"
            >
              {movie.poster_path && (
                <img
                  src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                  alt={movie.title}
                  className="w-full h-[300px] object-cover rounded-sm mb-3"
                />
              )}

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {movie.title}
              </h3>

              {onJellyfin && <JellyfinBadge available={true} />}

              {!onJellyfin && !isRequesting && (
                <button
                  onClick={() => setRequesting(movie.id)}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 w-full"
                >
                  Request
                </button>
              )}

              {isRequesting && (
                <RequestForm
                  isVisible={true}
                  onSubmit={(requestedBy) => handleRequest(movie, requestedBy)}
                  onCancel={() => setRequesting(null)}
                />
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/app/movies/import/page.tsx
git commit -m "feat: rewrite import page with Jellyfin integration"
```

---

### Task 11: Delete movie detail page

**Files:**
- Delete: `src/app/movies/[id]/page.tsx`

- [ ] **Step 1: Remove movie detail page directory**

Run:
```bash
rm -rf src/app/movies/[id]
```

- [ ] **Step 2: Commit**

Run:
```bash
git add -A && git commit -m "refactor: remove movie detail page"
```

---

### Task 12: Delete obsolete components

**Files:**
- Delete: `src/components/MovieCard.tsx`
- Delete: `src/components/MovieGrid.tsx`
- Delete: `src/components/SimilarMovies.tsx`
- Delete: `src/app/components/DeleteMovieButton.tsx`

- [ ] **Step 1: Delete old components**

Run:
```bash
rm -f src/components/MovieCard.tsx
rm -f src/components/MovieGrid.tsx
rm -f src/components/SimilarMovies.tsx
rm -f src/app/components/DeleteMovieButton.tsx
```

- [ ] **Step 2: Delete associated tests if they exist**

Run:
```bash
rm -f src/components/__tests__/MovieCard.test.tsx 2>/dev/null || true
rm -f src/components/__tests__/MovieGrid.test.tsx 2>/dev/null || true
rm -f src/components/__tests__/SimilarMovies.test.tsx 2>/dev/null || true
```

- [ ] **Step 3: Commit**

Run:
```bash
git add -A && git commit -m "refactor: remove obsolete MovieCard, MovieGrid, SimilarMovies, DeleteMovieButton"
```

---

### Task 13: Add fulfill action to RequestCard using server action form

**Files:**
- Modify: `src/components/RequestCard.tsx`

- [ ] **Step 1: Add fulfill action using server action form**

Since `RequestCard` is a client component, we wrap the fulfill action in a form:

```typescript
// src/components/RequestCard.tsx

'use client';

import Image from 'next/image';
import { JellyfinBadge } from './JellyfinBadge';
import { fulfillRequest } from '@/app/actions/request-actions';

interface Request {
  id: number;
  title: string;
  tmdb_id: number | null;
  poster_path: string | null;
  requested_at: Date;
  requested_by: string;
  status: 'pending' | 'downloading' | 'fulfilled';
  media_type: string;
}

interface Props {
  request: Request;
  onJellyfin: (tmdbId: number | null) => boolean;
}

export function RequestCard({ request, onJellyfin }: Props) {
  const [isFulfilling, setIsFulfilling] = useState(false);

  const posterUrl = request.poster_path
    ? `https://image.tmdb.org/t/p/w342${request.poster_path}`
    : null;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    downloading: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    fulfilled: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  };

  const jellyfinAvailable = onJellyfin(request.tmdb_id);

  const handleFulfill = async (formData: FormData) => {
    setIsFulfilling(true);
    try {
      await fulfillRequest(request.id);
    } catch (error) {
      console.error('Failed to fulfill request:', error);
    } finally {
      setIsFulfilling(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-sm shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex gap-4">
          {posterUrl ? (
            <div className="flex-shrink-0">
              <Image
                src={posterUrl}
                alt={request.title}
                width={120}
                height={180}
                className="rounded-sm"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-[120px] h-[180px] bg-gray-200 dark:bg-gray-700 rounded-sm flex items-center justify-center">
              No Poster
            </div>
          )}

          <div className="flex-grow">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {request.title}
            </h3>

            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${statusColors[request.status]}`}>
                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </span>

              {jellyfinAvailable && (
                <JellyfinBadge available={true} />
              )}
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              <p>Requested by: <span className="font-medium text-gray-900 dark:text-white">{request.requested_by}</span></p>
              <p>On: {formatDate(request.requested_at)}</p>
            </div>

            {request.status !== 'fulfilled' && (
              <form action={handleFulfill}>
                <button
                  type="submit"
                  disabled={isFulfilling}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isFulfilling ? 'Marking...' : 'Mark Fulfilled'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/components/RequestCard.tsx
git commit -m "fix: add fulfill action to RequestCard via server action form"
```
```

- [ ] **Step 3: Update requests page to remove onFulfill**

```typescript
// src/app/movies/page.tsx

import { prisma } from '@/lib/prisma';
import { RequestGrid } from '@/components/RequestGrid';
import { SearchInput } from '@/app/components/SearchInput';
import { Pagination } from '@/app/components/Pagination';
import { areMoviesOnJellyfin } from '@/lib/jellyfin';

const PAGE_SIZE = 12;

export default async function RequestsPage({
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

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { requested_at: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.request.count({ where }),
  ]);

  const tmdbIds = requests.map(r => r.tmdb_id).filter((id): id is number => id !== null);
  const jellyfinAvailability = await areMoviesOnJellyfin(tmdbIds);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Requests
      </h1>

      <div className="mb-6">
        <SearchInput defaultValue={query} />
      </div>

      <RequestGrid
        requests={requests}
        onJellyfin={(tmdbId) => jellyfinAvailability.get(tmdbId || 0) || false}
      />

      <Pagination currentPage={page} totalPages={totalPages} />
    </main>
  );
}
```

- [ ] **Step 4: Commit**

Run:
```bash
git add src/components/RequestCard.tsx src/components/RequestGrid.tsx src/app/movies/page.tsx
git commit -m "fix: add fulfill action to RequestCard"
```

---

### Task 14: Run tests and lint

**Files:**
- All

- [ ] **Step 1: Run full test suite**

Run:
```bash
npm test
```
Expected: All tests pass

- [ ] **Step 2: Run linter**

Run:
```bash
npm run lint
```
Expected: No errors

- [ ] **Step 3: Run typecheck**

Run:
```bash
npm run typecheck
```
Expected: No errors

- [ ] **Step 4: Commit**

Run:
```bash
git add -A && git commit -m "test: ensure all tests and checks pass"
```

---

### Task 15: Manual testing verification

- [ ] **Step 1: Start dev server**

Run:
```bash
npm run dev
```

- [ ] **Step 2: Test basic flow**

Manual steps to verify:
1. Navigate to `/movies` — should show empty "No requests yet" state
2. Navigate to `/movies/import`, search for a title
3. Confirm Jellyfin badge appears for movies on your server
4. Click "Request" on a non-Jellyfin movie, enter a name, submit
5. Confirm request appears on `/movies` page
6. Verify Jellyfin indicator works on request cards
7. Click "Mark Fulfilled" on a pending request, verify badge changes
8. Verify search/filter works on requests page

- [ ] **Step 3: Kill dev server**

Run: `Ctrl+C`

- [ ] **Step 4: No commit needed for verification**

---

## Implementation Complete

All tasks complete. The Jellyfin request tracker feature is fully implemented. Test coverage includes Jellyfin library, components, and server actions. The movie model has been removed and replaced with a Request model, and all UI components have been updated for the new workflow.
