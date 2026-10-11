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
  transitions.ts  — applyTransition: the module's single FSM-aware write path
                    (findUnique → canTransition → resolveSideEffects → update),
                    usable with the root client or inside a transaction
  projection.ts   — status→pill/action-variant, available-actions, cancel-allowed, model mapping
  validators.ts   — pure input validation (no throws)
  reads.ts        — operator-facing reads (listRequests, requestById); job-facing reads stay on jobsync.ts
  lifecycle.ts    — named transition verbs (fulfillRequest, downloadRequest, linkTorrent, cancelRequest) over applyTransition
  intake.ts       — createRequest, createTvRequests (row creation, not transitions)
  jobsync.ts      — job-facing reads + batch verbs (applySyncDecisions, autoLinkBatch, recordSuggestionBatch, …)
  repository.ts   — composition root: createRequestService wiring the four factory modules
  index.ts        — createRequestService({ prisma, enqueueJob, now, tmdb }) + default singleton + default enqueueJob shim
  use-request-actions.ts  — 'use client' hook unifying per-component dispatch
```

### Factory

```ts
createRequestService({
  prisma: PrismaClient,
  enqueueJob: (tx, type, payload) => Promise<void>,
  now?: () => Date,
  tmdb?: TmdbClient,
}): RequestService
```

`RequestService` is the union of the four module interfaces (`RequestLifecycle & RequestIntake & RequestJobSync & RequestReads`); callers depend on the narrow interface they need. Every transition — a named verb or a batch verb — passes through `applyTransition`. `createTvRequests` returns canonical `Request[]` (projected, not raw Prisma rows).

### FSM owns side-effects

`fsm.resolveSideEffects(from, to)` returns the fields to set on transition (`{ resolved_at: now, torrent_problem: null }` on `→ fulfilled`, `{ torrent_problem: null }` otherwise). `transitions.ts` spreads the result into the update on every path — named verbs and batch sync verbs alike. Lifecycle invariants live in one place.

### `InvalidTransitionError` typed error

The FSM throws `InvalidTransitionError` on disallowed transitions and on missing requests. Route handlers can match it for a `400`; the UI never sees it.

### Projection owns UI mapping

`projection.ts` exports `STATUS_CONFIG`, `statusToPill(status)`, `actionToButtonVariant(action)`, `getAvailableActions(status)`, `canCancel(status)`, and `toRequestModel(prismaRow)`. `getAvailableActions` returns FSM actions only — `cancel` is a separate `canCancel` check, so the danger signal stays visually distinct.

### `useRequestActions` hook

`useRequestActions({ request, onAfterCancel? })` returns `{ fulfill, download, cancel, isPending }`. The hook owns `try/catch` + per-request `isPending` + `logger.error`. Page-specific post-action effects (`router.refresh()`, `setDeleted(true)`, `onRemoved?.()`) pass in as callbacks.

### Cron path

The sync pass batches its verdicts through `jobsync.ts`: `applySyncDecisions` applies observation verdicts through `applyTransition` (a row that is gone or no longer transitionable is skipped, not thrown), and `autoLinkBatch` links suggestion winners the same way. The problem verdict stamps `torrent_problem` via `updateMany` inside the same transaction. No transition path bypasses the seam.

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
- `applySyncDecisions` / `autoLinkBatch` are the batch verbs on `jobsync.ts`; both spread `resolveSideEffects` through `applyTransition` inside a transaction the module owns.
- The problem verdict writes `torrent_problem` via `updateMany` in the same transaction; a row deleted before apply is skipped, never thrown.
- `applySyncDecisions` returns `{ applied, skipped }`; `SyncPassReport.fulfilled` counts applied, and `skipped` counts every unapplied decision.
- Re-linking a `downloading` Request to a different torrent remains out of scope (ADR-0005). `linkTorrent` keeps its current check.
- `request-actions.ts` (`'use server'`) calls `defaultService.<verb>` and adds `revalidatePath`; the file stays as the Next.js RPC boundary.
- Test surface reorganizes: `src/lib/request-lifecycle/__tests__/{fsm,projection,validators,service}.test.ts`. Test helpers co-locate per file.
- ADR-0005's wording about the cron "bypassing `transitionToStatus`" is amended to "calls `defaultService.fulfillBySync(reqId, tx)`," which lives in the same module.

## Pointer

- `src/lib/request-lifecycle/` — the module.
- `src/lib/jobs/transmission-sync.ts` — the cron; now consumes the module.
- `src/components/{RequestCard,RequestListItem}.tsx` and `src/app/requests/[id]/RequestDetail.tsx` — consume `useRequestActions`.