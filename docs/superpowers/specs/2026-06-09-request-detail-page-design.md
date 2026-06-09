# Request Detail Page Design

## Problem
Notification emails deep-link to `/requests/<id>` but that route returns 404 because no detail page exists.

## Goal
Add a single-request page that displays the same card UI and action buttons as the requests list, so email links work.

## Architecture

### Components
- **RequestCard** (`src/components/RequestCard.tsx`) — new reusable component extracted from `RequestListItem`. Takes a `Request` object and renders poster, title, status badge, overview, genres, requester info, and action buttons. Receives `onCancelRedirect` (optional callback) so single page can redirect after cancel.
- **RequestListItem** (`src/components/RequestListItem.tsx`) — refactored to a thin wrapper around `RequestCard`. Handles `onRemoved` and `deleted` state for list-specific behavior.
- **RequestDetail** (`src/app/requests/[id]/RequestDetail.tsx`) — new client component. Renders `RequestCard` with `onCancelRedirect={() => router.push('/requests')}`.

### Page
- **Server page** (`src/app/requests/[id]/page.tsx`) — new Next.js server component. Takes `params: { id: string }`. Fetches request from Prisma. If not found, returns `notFound()`. If present, fetches Jellyfin availability for the single `tmdb_id` and passes to `RequestDetail`.

## Data Flow
1. Server page fetches request by ID.
2. Missing → `notFound()`.
3. Present → fetches Jellyfin availability, passes to `RequestDetail`.
4. `RequestDetail` passes to `RequestCard` with cancel redirect handler.
5. `RequestCard` calls existing server actions: `fulfillRequest`, `downloadRequest`, `cancelRequest`.

## Error Handling
- Invalid/non-numeric ID → `notFound()`.
- Missing request → `notFound()`.
- Action errors logged, loading state resets (same as current behavior).

## Cancel Behavior
On cancel, redirect to `/requests` list page.

## Testing
- `RequestCard` tested with same cases as existing `RequestListItem`.
- New route tested: found request, missing request, action buttons.
