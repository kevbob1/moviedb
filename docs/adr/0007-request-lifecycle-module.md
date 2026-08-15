# ADR-0007: Request Lifecycle Module — One Seam for the Lifecycle

## Status

Accepted (2026-08-15).

## Context

The Request lifecycle — a small concept (three statuses, three verbs) — was scattered across five files in `src/lib/` plus duplicated handler maps in three components:

- `request-fsm.ts` (transitions + UI labels + pass-through re-export of `STATUS_CONFIG`)
- `request-service.ts` (DB writes + job enqueue + side-effects; `cancelRequest` bypasses the FSM)
- `request-utils.ts` (Prisma → UI model mapping)
- `request-theme.ts` (status pill colors / labels)
- `request-actions.ts` (thin `'use server'` wrappers)
- `RequestCard.tsx`, `RequestListItem.tsx`, `RequestDetail.tsx` (each carrying its own `try/catch` shells + handler maps)

The friction this produced:

1. The FSM knew about UI labels (`getActionsForStatus` returned `Start Download`, `Mark Fulfilled`) but did not know about lifecycle side-effects (`resolved_at` on fulfill, `torrent_problem` cleared on every transition).
2. The service wrote those side-effects inline, so changing the lifecycle meant editing every verb.
3. `cancelRequest` deleted the row without going through the FSM (no `canceled` state per ADR-0006), but the FSM didn't know about it either.
4. `transmission-sync` wrote `status: 'fulfilled'` inline, bypassing `transitionToStatus` deliberately (ADR-0005). The bypass was the only call site with the inline-write pattern.
5. `RequestCard` rendered a hardcoded Cancel button that bypassed `getActionsForStatus`.
6. `STATUS_CONFIG` was re-exported from `request-fsm.ts` (pass-through).
7. Three components each had their own `handleMarkFulfilled` / `handleDownload` / `handleCancel` blocks with the same `try/catch` + `logger.error` shells.

The codebase already had two factory precedents for ports-and-adapters modules (`createJellyfinCatalog(adapter)`, `createTransmissionSyncHandler({ adapter })`) that injected dependencies for testability. Request lifecycle had none.

## Decision

Collapse the five lib files into one module, `src/lib/request-lifecycle/`, behind a single factory and one interface.

### Module layout

```
src/lib/request-lifecycle/
  fsm.ts          — pure transitions + side-effects + typed error
  projection.ts   — status→pill/action-variant, available-actions, cancel-allowed, model mapping
  validators.ts   — pure input validation (no throws)
  repository.ts   — DB write helpers (createRequest, createTvRequests, linkTorrent, transitionToStatus, cancelRequest, fulfillBySync, flagTorrentProblem)
  index.ts        — createRequestService({ prisma, enqueueJob, now }) + default singleton + default enqueueJob shim
  use-request-actions.ts  — 'use client' hook unifying per-component dispatch
```

### Factory

```ts
createRequestService({
  prisma: PrismaClient,
  enqueueJob: (tx, type, payload) => Promise<void>,
  now?: () => Date,
}): RequestService
```

`RequestService` exposes the verbs: `createRequest`, `createTvRequests`, `linkTorrent`, `transitionToStatus`, `fulfillRequest`, `downloadRequest`, `cancelRequest`, `fulfillBySync`, `flagTorrentProblem`. `createTvRequests` returns canonical `Request[]` (projected, not raw Prisma rows).

### FSM owns side-effects

`fsm.resolveSideEffects(from, to)` returns the fields to set on transition (`{ resolved_at: now, torrent_problem: null }` on `→ fulfilled`, `{ torrent_problem: null }` otherwise). The repository spreads the result into the Prisma update. Lifecycle invariants live in one place.

### `InvalidTransitionError` typed error

The FSM throws `InvalidTransitionError` on disallowed transitions and on missing requests. Route handlers can match it for a `400`; the UI never sees it.

### Projection owns UI mapping

`projection.ts` exports `STATUS_CONFIG`, `statusToPill(status)`, `actionToButtonVariant(action)`, `getAvailableActions(status)`, `canCancel(status)`, and `toRequestModel(prismaRow)`. `getAvailableActions` returns FSM actions only — `cancel` is a separate `canCancel` check, so the danger signal stays visually distinct.

### `useRequestActions` hook

`useRequestActions({ request, onAfterCancel? })` returns `{ fulfill, download, cancel, isPending }`. The hook owns `try/catch` + per-request `isPending` + `logger.error`. Page-specific post-action effects (`router.refresh()`, `setDeleted(true)`, `onRemoved?.()`) pass in as callbacks.

### Cron path

`jobs/transmission-sync.ts` calls `defaultService.flagTorrentProblem(req.id, message, tx)` for missing or errored torrents, and `defaultService.fulfillBySync(req.id, tx)` for completion. The success path no longer bypasses the seam.

## Considered Options

- **Keep the five files, add `request-actions.ts` re-exports.** Rejected: same duplication, no testability gain.
- **Drop the named verbs (`fulfillRequest`, `downloadRequest`) and just expose `transitionToStatus`.** Rejected: callers lose the named-intent shape; `transitionToStatus(id, 'fulfilled')` is no clearer than `fulfillRequest(id)`.
- **Fold the cron `torrent_problem` writes inline; only fold the success path.** Rejected: the seam is then partial — `flagTorrentProblem` is two lines of code; the seam integrity is worth more than the locality.
- **Free-function module, global `prisma`.** Rejected: loses the testability the factory pattern buys everywhere else.
- **`transitionToStatus` private.** Rejected: tests lose the symmetric verb; the only thing it costs is one export line.

## Consequences

- Five lib files + three component handler maps collapse to one module + one hook.
- The FSM owns `resolveSideEffects`; the repository spreads it.
- `cancel` is a verb on the service (the FSM still has no `canceled` state, per ADR-0006).
- `fulfillBySync(reqId, tx)` is the new verb the cron uses to satisfy ADR-0005's bypass — the bypass shrinks to "must run inside an existing transaction," the only reason it was inline.
- `flagTorrentProblem(reqId, problem, tx)` is a new verb; the cron no longer writes `torrent_problem` directly.
- Re-linking a `downloading` Request to a different torrent remains out of scope (ADR-0005). `linkTorrent` keeps its current check.
- `request-actions.ts` (`'use server'`) calls `defaultService.<verb>` and adds `revalidatePath`; the file stays as the Next.js RPC boundary.
- Test surface reorganizes: `src/lib/request-lifecycle/__tests__/{fsm,projection,validators,service}.test.ts`. Test helpers co-locate per file.
- ADR-0005's wording about the cron "bypassing `transitionToStatus`" is amended to "calls `defaultService.fulfillBySync(reqId, tx)`," which lives in the same module.

## Pointer

- `src/lib/request-lifecycle/` — the module.
- `src/lib/jobs/transmission-sync.ts` — the cron; now consumes the module.
- `src/components/{RequestCard,RequestListItem}.tsx` and `src/app/requests/[id]/RequestDetail.tsx` — consume `useRequestActions`.