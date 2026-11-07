# ADR-0012: Jobs Module — One Module for Job State

## Status

Accepted (2026-11-06).

## Context

CONTEXT.md makes **Job** a first-class domain concept, but no module owned its state. The knowledge was scattered across five homes:

- `src/lib/job-queue.ts` — the processing machinery (stuck sweep, atomic claim, retry/exhaustion, outcome writes) plus all four status literals written inline.
- `src/lib/jobs/transmission-sync.ts` — a *second* set of jobs-table writes: the coalescing `findOutstandingSync` / `settleOutstanding` / unique-violation retry loop, and the enqueue insert.
- `src/lib/jobs/transmission-sync-status.ts` — a third file owning status semantics (the sync label map).
- `src/lib/needs-match/read.ts` — a *read* module selecting raw `jobs` rows (`created_at`, `completed_at`) for the needs-match page, its deps hiding a direct table query.
- `src/components/NeedsMatchSyncControl.tsx` — the terminal-status set hardcoded client-side (`completed | failed`), plus a hand-rolled `createdAt`-string comparison protocol between server render and client poll.

Friction: understanding "what is the state of job type X" required bouncing across five files; adding a job type touched registration in two places (side-effect barrel `src/lib/jobs/index.ts` *and* explicit `registerJobType` calls in the process-jobs route — the route comment claiming "the single registration seam" contradicted the barrel); no module boundary concentrated the queue discipline, so coalescing policy was caller-visible plumbing instead of implementation.

## Decision

One jobs module at `src/lib/jobs/` owns all job state. `index.ts` is the module barrier; everything else is implementation.

### Module layout

```
src/lib/jobs/
  contracts.ts  — JobType / JobStatus unions, JobRun, per-type JobPayloads, JobHandler
  status.ts     — jobStatusLabel / syncRunLabel, isTerminalStatus (absorbs transmission-sync-status.ts)
  enqueue.ts    — enqueue(type, payload) + enqueueInTx(tx, type, payload); per-type coalescing policy inside
  latest.ts     — latestRun(type) → JobRun | null
  queue.ts      — processing machinery (was src/lib/job-queue.ts, moved verbatim)
  index.ts      — barrier + registerAllJobTypes() (the single registration seam)
```

Deleted: `src/lib/job-queue.ts`, `src/lib/jobs/transmission-sync-status.ts`, and the enqueue/registration section of `transmission-sync.ts` (the handler body's business logic is untouched).

### Interface

```ts
enqueue(type: JobType, payload): Promise<EnqueueResult>      // { queued, job: { status, queuedAt } }
enqueueInTx(tx: Tx, type: JobType, payload): Promise<void>   // transaction-threaded
latestRun(type: JobType): Promise<JobRun | null>
processPendingJobs(): Promise<ProcessResult>                  // cron route's only use
registerAllJobTypes(): void                                   // exported; called only by the cron route
```

- **`JobRun = { status, queuedAt, finishedAt, error, trigger?, terminal }`** — the domain projection. `queuedAt` ← `created_at`, `finishedAt` ← `completed_at`, ISO strings converted inside the module, `terminal = completed | failed`. Deliberately **no `startedAt`**: the `jobs` table has no such column and `status === 'processing'` covers it coarsely; if duration-per-run is ever needed, that is an explicit schema migration, not a naming accident. DB column names do not cross the seam.
- **Per-type enqueue policy inside the module**: `transmission_sync` keeps its singleton discipline (partial unique index `jobs_singleton_live_type_key`, manual-trigger upgrade of a queued non-manual sync, 23505 race retry); notification types are plain inserts, never coalescing today. Callers do not know the discipline of the job they enqueue.
- **`enqueueInTx` exists because notification enqueue is transaction-threaded**: `request-lifecycle`'s intake (`createRequest`, `createTvRequests`) enqueues inside its own DB transaction so notifications commit atomically with Request rows. Lifecycle keeps its injected `enqueueJob` dependency (accept-dependencies convention), now backed by this verb — replacing the raw `tx.insert(jobs)` shim. Payloads are typechecked via the `JobPayloads` map; stored payload shapes are unchanged.
- **Status vocabulary lives in the module**: the `JobStatus` union, label projections (`jobStatusLabel`, and `syncRunLabel` preserving the exact sync UI strings), and `terminal` on `JobRun`. Client components consume projections and keep no hardcoded status sets; the 5 s poll / 75 s timeout on `/needs-match` stays a client (UX cadence) concern.

## Considered Options

- **Keep `job-queue.ts` at `src/lib/` and add an interface over it.** Rejected: two homes for one module, the split suggests a seam where none exists.
- **Typing `registerJobType(type: string, ...)` as today.** Rejected: open-string types are how the duplicate `JOB_TYPE` const and the inline `'transmission_sync'` literal drifted apart; the union keeps registrations honest.
- **Absorb the stuck-sweep/claim/retry machinery into verbs-per-caller.** Rejected: `processPendingJobs` is the cron's whole interface and the claim SQL is volatile implementation — hiding it is the depth payoff.
- **`startedAt` on JobRun (schema change).** Rejected (YAGNI): no consumer measures run duration today; the projection is additive later — the column is not.

## Consequences

- Every jobs-table query lives in the module (verified: zero jobs-table SQL outside `src/lib/jobs/`).
- Registration is single-seam: the process-jobs route calls `registerAllJobTypes()`; handler self-registration side effects are gone, and the barrel contradiction is resolved in favour of the route.
- needs-match drops its raw `jobs` select; it receives `latestSyncRun` as a port and passes `JobRun` (with `terminal`) to pages and client components — the client terminal set and duplicate label map are deleted.
- Coalescing/race/upgrade behaviour is tested at the interface (`enqueue` twice ⇒ one row; manual upgrade semantics) instead of through SQL transcripts.
- Queue-discipline changes (e.g. a second singleton job type) become policy configuration inside the enqueue implementation — no caller changes.

## Pointer

- `src/lib/jobs/` — the module (`contracts`, `status`, `enqueue`, `latest`, `queue`, `index` barrier).
- `src/app/api/cron/process-jobs/route.ts` — process caller + registration seam.
- `src/app/actions/transmission-actions.ts` — manual enqueue server action.
- `src/lib/request-lifecycle/index.ts` — intake wiring of `enqueueInTx` as `enqueueJob`.
- `src/lib/needs-match/read.ts` — `latestSyncRun` port; `src/components/{TransmissionStatusBanner,NeedsMatchSyncControl}.tsx` — `JobRun` consumers.
