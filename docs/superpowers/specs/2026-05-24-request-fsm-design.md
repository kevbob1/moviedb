# Request FSM + List View + Filter Design

**Date:** 2026-05-24
**Topic:** Codify FSM for Request model, enable list format, add fulfilled filter

## Problem Context

The Request model currently has ad-hoc status handling:
- `status` is a plain `String` field with values `pending | downloading | fulfilled`
- No FSM enforcement — transitions are scattered across components
- `cancelRequest` **deletes** the request instead of setting a canceled status (buggy)
- `RequestListItem` has a critical bug: "Mark Fulfilled" calls `cancelRequest` (deletes instead of fulfilling)
- No action exists to transition `pending → downloading` — the status is defined in types but never assigned
- `RequestListItem` component exists but is buggy; only `RequestGrid` is used in UI
- No filter to hide fulfilled requests from the list

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Cancel behavior** | Set `status='canceled'` (persisted terminal state) | Preserves audit trail, FSM is complete with all transitions |
| **List format** | Use existing `RequestListItem` component | Already exists, just needs fixes. No new component needed. |
| **FSM implementation** | Plain TypeScript module (`src/lib/request-fsm.ts`) | No state machine library in project. Light, testable, follows existing `src/lib/` pattern. |
| **Status DB type** | Keep as `String` (not Prisma enum) | User preference. FSM module will enforce valid values at app layer. |
| **Implementation order** | FSM-First (Approach A) | Single source of truth. Build FSM → refactor server actions → fix components → add filter. |

## Design

### 1. FSM Module

**File:** `src/lib/request-fsm.ts`

The FSM is codified as a plain TypeScript module with:

**Status type:**
```typescript
type RequestStatus = 'pending' | 'downloading' | 'fulfilled' | 'canceled'
```

**Transition map:**
```
pending     → downloading
pending     → fulfilled
pending     → canceled
downloading → fulfilled
downloading → canceled
```
`fulfilled` and `canceled` are terminal states — no outgoing transitions.

**Core exports:**

| Export | Type | Description |
|--------|------|-------------|
| `RequestStatus` | Union type | Valid status values |
| `REQUEST_TRANSITIONS` | `Record<RequestStatus, RequestStatus[]>` | Maps each status to array of valid next statuses |
| `canTransition(from, to)` | `(from: RequestStatus, to: RequestStatus) => boolean` | Pure function, returns true if transition is legal |
| `getAllowedTransitions(status)` | `(status: RequestStatus) => RequestStatus[]` | Returns array of valid next statuses for a given status |
| `getActionsForStatus(status)` | `(status: RequestStatus) => Action[]` | Returns UI actions: `[{ action, label, nextStatus }]` for button rendering |
| `STATUS_CONFIG` | `Record<RequestStatus, { label, color, bgColor }>` | Badge labels and color mappings |

Example `getActionsForStatus('pending')`:
```typescript
[
  { action: 'download', label: 'Start Download', nextStatus: 'downloading' },
  { action: 'fulfill', label: 'Mark Fulfilled', nextStatus: 'fulfilled' },
  { action: 'cancel', label: 'Cancel', nextStatus: 'canceled' }
]
```

**Server action validation:** Each server action that changes status calls `canTransition(currentStatus, newStatus)` before updating. Throws on invalid transitions.

---

### 2. Server Actions

**File:** `src/app/actions/request-actions.ts` (modify existing)

| Action | Current behavior | New behavior |
|---|---|---|
| `createRequest(tmdbId, title, posterPath, requestedBy)` | Creates with `status: 'pending'` | No change |
| `fulfillRequest(requestId)` | Updates to `'fulfilled'` without checking current status (risky) | Fetches request, validates `canTransition(request.status, 'fulfilled')`, then updates |
| `cancelRequest(requestId)` | **Deletes** the request from DB | Fetches request, validates `canTransition(request.status, 'canceled')`, sets `status: 'canceled'` |
| `downloadRequest(requestId)` | Doesn't exist | Fetches request, validates `canTransition(request.status, 'downloading')`, sets `status: 'downloading'` |

**Mutation pattern:**
1. Fetch request by ID
2. Check `canTransition(request.status, nextStatus)` — throw if invalid
3. Update status
4. Return updated request

**API routes:** The `DELETE /api/requests/[id]` route stays as-is for admin/hard-delete scenarios — it's separate from the FSM-cancel flow.

---

### 3. UI Components & List View

**Replace `RequestGrid` + `RequestCard` with `RequestList` + `RequestListItem`** as the primary display on `/movies`.

**`RequestListItem`** (modify existing file: `src/components/RequestListItem.tsx`):
- Remove local `GENRE_MAP` / `getGenreNames` — extract to `src/lib/genres.ts` (shared across components)
- Import `RequestStatus` and FSM functions from `request-fsm.ts`
- Fix bug: "Mark Fulfilled" currently calls `cancelRequest` → will call `fulfillRequest`
- **Button rendering driven by FSM:**
  - Call `getActionsForStatus(request.status)`
  - Render one button per allowed action
  - Each button calls the corresponding server action (`downloadRequest`, `fulfillRequest`, `cancelRequest`)
  - Terminal states (`fulfilled`, `canceled`) render no action buttons
- Status badge uses `STATUS_CONFIG` from FSM module for label and colors

**`RequestList`** (replace `RequestGrid` — `src/components/RequestGrid.tsx` → rename/refactor):
- Accepts `requests[]` and `jellyfinAvailability` props (same as current `RequestGrid`)
- Renders a vertical list of `RequestListItem` components (not a grid)
- Shows empty state "No requests yet" when list is empty

**`/movies` page** (`src/app/movies/page.tsx`):
- Replace `<RequestGrid>` with `<RequestList>`
- Pass `showFulfilled` filter state (see Section 4)

**Cleanup:** Delete `RequestCard.tsx` — replaced by `RequestListItem`. Keep `RequestList` (renamed from `RequestGrid`).

---

### 4. Fulfilled Filter

**`/movies` page changes:**

- By default, requests with `status: 'fulfilled'` and `status: 'canceled'` are excluded from the query
- A checkbox labeled "Show fulfilled" controls this filter
- When checked, fulfilled requests are included in the results (canceled stays hidden)
- Filter state lives as a URL search param (`?showFulfilled=true`) so it's shareable and survives page refresh
- The server component reads the param and adjusts the Prisma `where` clause:

| Filter state | Prisma `where` clause |
|--------------|----------------------|
| **Default (unchecked)** | `where: { status: { notIn: ['fulfilled', 'canceled'] } }` |
| **Checked** | `where: { status: { notIn: ['canceled'] } }` |

**Checkbox placement:** A simple control near `SearchInput`, not inside `SearchInput` component.

---

## Files to Modify

| File | Change type |
|------|-------------|
| `src/lib/request-fsm.ts` | **NEW** — FSM module |
| `src/lib/genres.ts` | **NEW** — Shared genre helpers (extracted from components) |
| `src/app/actions/request-actions.ts` | **MODIFY** — Fix `cancelRequest`, add `downloadRequest`, add FSM validation |
| `src/components/RequestListItem.tsx` | **MODIFY** — Use FSM for button rendering, fix fulfill bug, remove duplicated genre helpers |
| `src/components/RequestGrid.tsx` | **RENAME/REFCTOR** → `RequestList.tsx` — Change grid layout to list |
| `src/components/RequestCard.tsx` | **DELETE** — Replaced by RequestListItem |
| `src/app/movies/page.tsx` | **MODIFY** — Use RequestList, add fulfilled filter checkbox, apply filter to query |

---

## Testing Requirements

### Unit tests
- **`src/lib/__tests__/request-fsm.test.ts`** (NEW)
  - Test all valid transitions return true
  - Test invalid transitions return false
  - Test terminal states have no outgoing transitions
  - Test `getActionsForStatus` returns correct actions for each state
  - Test `STATUS_CONFIG` has all statuses defined

- **`src/app/actions/__tests__/request-actions.test.ts`** (MODIFY)
  - Update test mocks for new behavior (cancel sets status instead of delete)
  - Add test for `downloadRequest` action
  - Add FSM validation tests (throws on invalid transitions)

- **`src/components/__tests__/RequestListItem.test.tsx`** (NEW)
  - Test renders status badge with correct color for each status
  - Test renders correct buttons based on status (using FSM helpers)
  - Test terminal states render no buttons
  - Test "Mark Fulfilled" bug is fixed

### E2E tests
- **`tests/e2e/request-fsm.spec.ts`** (NEW)
  - Test request lifecycle: pending → downloading → fulfilled
  - Test pending → fulfilled
  - Test pending → canceled
  - Test downloading → canceled
  - Test invalid transitions are prevented (e.g., fulfilled → downloading should fail)
  - Test fulfilled filter checkbox shows/hides fulfilled requests

- **`tests/delete-movie.spec.ts`** (MODIFY/DELETE)
  - This test is legacy/broken (references old schema). Consider updating or removing.

---

## Implementation Order

Following the FSM-First approach:

1. **Create FSM module** (`src/lib/request-fsm.ts`)
2. **Create shared genre helpers** (`src/lib/genres.ts`)
3. **Add tests for FSM module**
4. **Refactor server actions** (`request-actions.ts` with FSM validation)
5. **Add `downloadRequest` action**
6. **Update server action tests**
7. **Fix `RequestListItem`** component (use FSM, fix bugs)
8. **Convert `RequestGrid` to `RequestList`** (list layout)
9. **Delete `RequestCard.tsx`**
10. **Add fulfilled filter** to `/movies` page (checkbox + DB query)
11. **Add `RequestListItem` tests**
12. **Add E2E tests for FSM**

---

## Success Criteria

- FSM module is single source of truth for transitions
- Server actions validate transitions and throw on invalid states
- Cancel sets `status='canceled'` instead of deleting
- `pending → downloading` is possible via server action
- All button display/logic is driven by FSM (no hardcoded transitions in components)
- `/movies` shows list format by default (not grid)
- Fulfilled requests are hidden by default, shown via checkbox
- All bugs fixed (especially `RequestListItem.handleMarkFulfilled`)
- Test coverage for new FSM logic
- No regressions in existing functionality
