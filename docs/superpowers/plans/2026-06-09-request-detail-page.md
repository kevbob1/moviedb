# Request Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-request detail page at `/requests/[id]` that reuses the existing card UI and action buttons, so notification email deep links work.

**Architecture:** Extract the card UI from `RequestListItem` into a reusable `RequestCard` component, refactor `RequestListItem` as a thin wrapper, and create a new server page at `/requests/[id]` that fetches a single request and renders it via a new `RequestDetail` client component.

**Tech Stack:** Next.js 15 App Router, React, Prisma, TypeScript, Tailwind CSS, Jest, React Testing Library

---

## File Structure

- **Create:** `src/components/RequestCard.tsx` — Reusable card UI with poster, title, status, info, and action buttons
- **Modify:** `src/components/RequestListItem.tsx` — Refactor to thin wrapper around `RequestCard`
- **Create:** `src/app/requests/[id]/RequestDetail.tsx` — Client component for detail page (handles cancel redirect)
- **Create:** `src/app/requests/[id]/page.tsx` — Server component that fetches single request
- **Create:** `src/components/__tests__/RequestCard.test.tsx` — Tests for extracted card
- **Create:** `src/app/requests/[id]/__tests__/page.test.tsx` — Tests for detail page

---

### Task 1: Extract RequestCard Component

**Files:**
- Create: `src/components/RequestCard.tsx`
- Modify: `src/components/RequestListItem.tsx`

**Context:** `RequestListItem.tsx` currently contains all the card UI and button logic. We extract the rendering into `RequestCard`, leaving `RequestListItem` as a thin wrapper that handles the `deleted` state and list-specific `onRemoved` callback.

- [ ] **Step 1: Write the failing test for RequestCard**

Create `src/components/__tests__/RequestCard.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import RequestCard from '../RequestCard';
import { RequestStatus } from '@/lib/request-fsm';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />;
  },
}));

const mockRequest = {
  id: 1,
  title: 'Test Movie',
  tmdb_id: 123,
  poster_path: '/test.jpg',
  overview: 'A test movie',
  release_date: '2023-01-01',
  genre_ids: [28, 35],
  requested_by: 'Alice',
  requested_at: '2023-06-01T00:00:00Z',
  status: 'pending' as RequestStatus,
  media_type: 'movie',
};

const mockHandlers = {
  onMarkFulfilled: jest.fn(),
  onDownload: jest.fn(),
  onCancel: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RequestCard', () => {
  it('renders title and status', () => {
    render(<RequestCard request={mockRequest} {...mockHandlers} />);
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders action buttons for pending status', () => {
    render(<RequestCard request={mockRequest} {...mockHandlers} />);
    expect(screen.getByText('Mark Fulfilled')).toBeInTheDocument();
    expect(screen.getByText('Mark Downloading')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls handlers on button clicks', () => {
    render(<RequestCard request={mockRequest} {...mockHandlers} />);
    fireEvent.click(screen.getByText('Mark Fulfilled'));
    expect(mockHandlers.onMarkFulfilled).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Mark Downloading'));
    expect(mockHandlers.onDownload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockHandlers.onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/RequestCard.test.tsx --no-coverage`

Expected: FAIL with "Cannot find module '../RequestCard'"

- [ ] **Step 3: Create RequestCard component**

Create `src/components/RequestCard.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { RequestStatus, getActionsForStatus } from '@/lib/request-fsm';
import { STATUS_CONFIG } from '@/lib/request-theme';
import { getGenreNames } from '@/lib/genres';

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

interface RequestCardProps {
  request: Request;
  onMarkFulfilled: () => void;
  onDownload: () => void;
  onCancel: () => void;
  jellyfinAvailable?: boolean;
}

const ACTION_STYLES: Record<string, string> = {
  download: 'bg-blue-600 hover:bg-blue-700',
  fulfill: 'bg-green-600 hover:bg-green-700',
  cancel: 'bg-red-600 hover:bg-red-700',
};

export default function RequestCard({
  request,
  onMarkFulfilled,
  onDownload,
  onCancel,
  jellyfinAvailable = false,
}: RequestCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const statusConfig = STATUS_CONFIG[request.status];
  const actions = getActionsForStatus(request.status);

  const handleAction = async (action: string, handler: () => void) => {
    setIsLoading(true);
    try {
      handler();
    } finally {
      setIsLoading(false);
    }
  };

  const posterUrl = request.poster_path
    ? `https://image.tmdb.org/t/p/w154${request.poster_path}`
    : null;

  return (
    <div className="flex gap-4 p-4 border-b">
      {posterUrl && (
        <div className="poster-md">
          <Image
            src={posterUrl}
            alt={request.title}
            width={96}
            height={144}
            className="poster-img"
          />
        </div>
      )}

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold">
            {request.title}
            {request.season_number && (
              <span className="ml-1 text-sm font-normal text-year">
                — Season {request.season_number}
              </span>
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

        <div className="flex gap-2 mt-2">
          {actions.map((action) => {
            const handleClick = () => {
              if (action.action === 'fulfill') {
                handleAction(action.action, onMarkFulfilled);
              } else if (action.action === 'download') {
                handleAction(action.action, onDownload);
              } else if (action.action === 'cancel') {
                handleAction(action.action, onCancel);
              }
            };

            const colorClass = ACTION_STYLES[action.action] || 'bg-primary hover:opacity-90';

            return (
              <button
                key={action.action}
                onClick={(e) => {
                  e.preventDefault();
                  handleClick();
                }}
                disabled={isLoading}
                className={`btn-action ${colorClass}`}
              >
                {isLoading ? 'Loading...' : action.label}
              </button>
            );
          })}
        </div>

        {jellyfinAvailable && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-2">
            Available in Jellyfin
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/RequestCard.test.tsx --no-coverage`

Expected: PASS

- [ ] **Step 5: Refactor RequestListItem to use RequestCard**

Modify `src/components/RequestListItem.tsx`:

```typescript
'use client';

import { useState, useSyncExternalStore } from 'react';
import { RequestStatus } from '@/lib/request-fsm';
import { logger } from '@/lib/logger';
import { fulfillRequest, downloadRequest, cancelRequest } from '@/app/actions/request-actions';
import RequestCard, { Request } from './RequestCard';

interface Props {
  request: Request;
  onRemoved?: () => void;
  jellyfinAvailable?: boolean;
}

export function RequestListItem({ request, onRemoved, jellyfinAvailable = false }: Props) {
  const [deleted, setDeleted] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const handleMarkFulfilled = async () => {
    try {
      await fulfillRequest(request.id);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to mark as fulfilled');
    }
  };

  const handleDownload = async () => {
    try {
      await downloadRequest(request.id);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to download');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelRequest(request.id);
      setDeleted(true);
      onRemoved?.();
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cancel');
    }
  };

  if (deleted) return null;

  return (
    <RequestCard
      request={{
        ...request,
        requested_at: mounted ? request.requested_at : request.requested_at,
      }}
      onMarkFulfilled={handleMarkFulfilled}
      onDownload={handleDownload}
      onCancel={handleCancel}
      jellyfinAvailable={jellyfinAvailable}
    />
  );
}

export type { Request };
```

- [ ] **Step 6: Run existing RequestListItem tests to verify no regressions**

Run: `npx jest src/components/__tests__/RequestListItem.test.tsx --no-coverage`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/RequestCard.tsx src/components/__tests__/RequestCard.test.tsx src/components/RequestListItem.tsx
git commit -m "refactor: extract RequestCard from RequestListItem"
```

---

### Task 2: Create RequestDetail Client Component

**Files:**
- Create: `src/app/requests/[id]/RequestDetail.tsx`

**Context:** This client component wraps `RequestCard` and handles the cancel redirect to the list page.

- [ ] **Step 1: Write the failing test for RequestDetail**

Create `src/app/requests/[id]/__tests__/RequestDetail.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RequestDetail from '../RequestDetail';
import { RequestStatus } from '@/lib/request-fsm';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockRequest = {
  id: 1,
  title: 'Test Movie',
  tmdb_id: 123,
  poster_path: '/test.jpg',
  overview: 'A test movie',
  release_date: '2023-01-01',
  genre_ids: [28],
  requested_by: 'Alice',
  requested_at: '2023-06-01T00:00:00Z',
  status: 'pending' as RequestStatus,
  media_type: 'movie',
};

jest.mock('@/app/actions/request-actions', () => ({
  fulfillRequest: jest.fn(),
  downloadRequest: jest.fn(),
  cancelRequest: jest.fn(),
}));

import { cancelRequest } from '@/app/actions/request-actions';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RequestDetail', () => {
  it('renders request card', () => {
    render(<RequestDetail request={mockRequest} jellyfinAvailable={false} />);
    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('redirects to list on cancel', async () => {
    (cancelRequest as jest.Mock).mockResolvedValueOnce({});
    render(<RequestDetail request={mockRequest} jellyfinAvailable={false} />);
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/requests');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/requests/[id]/__tests__/RequestDetail.test.tsx --no-coverage`

Expected: FAIL with "Cannot find module '../RequestDetail'"

- [ ] **Step 3: Create RequestDetail component**

Create `src/app/requests/[id]/RequestDetail.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import RequestCard, { Request } from '@/components/RequestCard';
import { logger } from '@/lib/logger';
import { fulfillRequest, downloadRequest, cancelRequest } from '@/app/actions/request-actions';

interface RequestDetailProps {
  request: Request;
  jellyfinAvailable: boolean;
}

export default function RequestDetail({ request, jellyfinAvailable }: RequestDetailProps) {
  const router = useRouter();

  const handleMarkFulfilled = async () => {
    try {
      await fulfillRequest(request.id);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to mark as fulfilled');
    }
  };

  const handleDownload = async () => {
    try {
      await downloadRequest(request.id);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to download');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelRequest(request.id);
      router.push('/requests');
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to cancel');
    }
  };

  return (
    <RequestCard
      request={request}
      onMarkFulfilled={handleMarkFulfilled}
      onDownload={handleDownload}
      onCancel={handleCancel}
      jellyfinAvailable={jellyfinAvailable}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/requests/[id]/__tests__/RequestDetail.test.tsx --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/requests/[id]/RequestDetail.tsx src/app/requests/[id]/__tests__/RequestDetail.test.tsx
git commit -m "feat: add RequestDetail component for single request page"
```

---

### Task 3: Create Server Page Route

**Files:**
- Create: `src/app/requests/[id]/page.tsx`

**Context:** Server component that fetches a single request by ID. If not found, returns `notFound()`. Fetches Jellyfin availability for the single request.

- [ ] **Step 1: Write the failing test for the page**

Create `src/app/requests/[id]/__tests__/page.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import RequestPage from '../page';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    request: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/jellyfin', () => ({
  areMoviesOnJellyfin: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

import { prisma } from '@/lib/prisma';
import { areMoviesOnJellyfin } from '@/lib/jellyfin';
import { notFound } from 'next/navigation';

beforeEach(() => {
  jest.clearAllMocks();
});

const mockRequest = {
  id: 1,
  title: 'Test Movie',
  tmdb_id: 123,
  poster_path: '/test.jpg',
  overview: 'A test movie',
  release_date: '2023-01-01',
  genre_ids: [28],
  requested_by: 'Alice',
  requested_at: new Date('2023-06-01T00:00:00Z'),
  status: 'pending',
  season_number: null,
  media_type: 'movie',
};

describe('RequestPage', () => {
  it('renders request detail for valid id', async () => {
    (prisma.request.findUnique as jest.Mock).mockResolvedValueOnce(mockRequest);
    (areMoviesOnJellyfin as jest.Mock).mockResolvedValueOnce(new Map([[123, true]]));

    const Component = await RequestPage({ params: Promise.resolve({ id: '1' }) });
    render(Component);

    expect(screen.getByText('Test Movie')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('calls notFound for missing request', async () => {
    (prisma.request.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      RequestPage({ params: Promise.resolve({ id: '999' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/requests/[id]/__tests__/page.test.tsx --no-coverage`

Expected: FAIL with "Cannot find module '../page'"

- [ ] **Step 3: Create server page**

Create `src/app/requests/[id]/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma';
import { areMoviesOnJellyfin } from '@/lib/jellyfin';
import { notFound } from 'next/navigation';
import RequestDetail from './RequestDetail';

import type { RequestStatus } from '@/lib/request-fsm';

export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const requestId = parseInt(id, 10);

  if (isNaN(requestId)) {
    notFound();
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    notFound();
  }

  const tmdbId = request.tmdb_id;
  let jellyfinAvailability = false;
  if (tmdbId !== null) {
    const availabilityMap = await areMoviesOnJellyfin([tmdbId]);
    jellyfinAvailability = availabilityMap.get(tmdbId) ?? false;
  }

  const typedRequest = {
    ...request,
    tmdb_id: request.tmdb_id ?? undefined,
    poster_path: request.poster_path ?? undefined,
    overview: request.overview ?? undefined,
    release_date: request.release_date ?? undefined,
    requested_at: request.requested_at.toISOString(),
    status: request.status as RequestStatus,
    season_number: request.season_number ?? undefined,
    media_type: request.media_type ?? undefined,
  };

  return (
    <main className="page-container">
      <h1 className="page-title">Request Details</h1>
      <RequestDetail request={typedRequest} jellyfinAvailable={jellyfinAvailability} />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/requests/[id]/__tests__/page.test.tsx --no-coverage`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/requests/[id]/page.tsx src/app/requests/[id]/__tests__/page.test.tsx
git commit -m "feat: add request detail page route"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Extract `RequestCard` from `RequestListItem` → Task 1
- ✅ Refactor `RequestListItem` as thin wrapper → Task 1
- ✅ Create `/requests/[id]` server page → Task 3
- ✅ Create `RequestDetail` client component with cancel redirect → Task 2
- ✅ Reuse same card UI and buttons → Task 1
- ✅ 404 for missing request → Task 3
- ✅ Jellyfin availability check on detail page → Task 3

**2. Placeholder scan:**
- No "TBD", "TODO", or "implement later" found.
- No vague "add error handling" steps.
- All test code is complete.
- All implementation code is complete.

**3. Type consistency:**
- `Request` type used consistently across `RequestCard`, `RequestListItem`, and `RequestDetail`.
- `RequestStatus` imported from `@/lib/request-fsm` everywhere.
- `jellyfinAvailable` prop is `boolean` consistently.

**4. No regressions:**
- Existing `RequestListItem` tests must still pass after refactoring.
- Existing request-actions tests unaffected.
- Existing `/requests` page unaffected.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-09-request-detail-page.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
