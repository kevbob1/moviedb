# Background Job Queue & Submission Indicator

## Problem

When a user submits a request, the name input clears immediately but there is no visual feedback while the server action runs. The SMTP `sendRequestNotification` call blocks inside `createRequest`, making the user wait for both the DB write and the email round-trip before seeing any response. For TV series, this compounds — one email per season, each awaited sequentially.

## Design

### 1. Job Table & Handler Registry

**Prisma model:**

```prisma
model Job {
  id           Int       @id @default(autoincrement())
  type         String
  payload      Json      @db.JsonB
  status       String    // "pending" | "processing" | "completed" | "failed"
  attempts     Int       @default(0)
  maxAttempts  Int       @default(3)
  error        String?
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt
  completed_at DateTime?

  @@map("jobs")
}
```

**Handler registry — typed dispatch:**

```ts
// src/lib/job-queue.ts

interface JobHandler<T> {
  handle: (payload: T) => Promise<void>;
}

const handlers = new Map<string, JobHandler<unknown>>();

function registerJobType<T>(type: string, handler: JobHandler<T>) {
  handlers.set(type, handler as JobHandler<unknown>);
}

async function processJob(job: Job) {
  const handler = handlers.get(job.type);
  if (!handler) throw new Error(`No handler for job type: ${job.type}`);
  await handler.handle(job.payload as T);
}
```

Each job type registers its payload shape alongside its handler at module load time. The processor looks up the handler by `type` and invokes it — no switch statement, no hardcoded dispatch.

| Job type | Payload | Handler |
|---|---|---|
| `request_notification` | Single `NotificationRequest` | Sends per-request email |
| `tv_series_request_notification` | Series info + season list | Sends series-level email |

### 2. Enqueuing via Transactional Outbox

Job creation is inside the same Prisma transaction as the request insert(s). Either both persist or neither — no orphaned requests without notifications.

**Single request (movies, individual seasons):**

We use the sequential `$transaction` variant so the job payload can reference the created request's auto-generated `id`:

```ts
const created = await prisma.$transaction(async (tx) => {
  const request = await tx.request.create({ data: { ... } });
  await tx.job.create({
    data: {
      type: 'request_notification',
      payload: { ...request },  // includes generated id
      status: 'pending',
    },
  });
  return request;
});
```

**TV series batch (all seasons at once):**

```ts
const createdRequests = await prisma.$transaction(async (tx) => {
  const requests = [];
  for (const season of seasons) {
    const req = await tx.request.create({ data: { ...seasonFields } });
    requests.push(req);
  }
  await tx.job.create({
    data: {
      type: 'tv_series_request_notification',
      payload: {
        title: details.name,
        requestedBy,
        seasons: seasons.map(s => s.season_number),
        totalSeasons: seasons.length,
        posterPath: details.poster_path,
        ...other series-level fields
      },
      status: 'pending',
    },
  });
  return requests;
});
```

One transaction, one job, one email for the whole series.

**Key behavioral change:** `createTvRequests` no longer calls `createRequest` per season. It builds all records itself in a single transaction. `createRequest` also no longer calls `sendRequestNotification` directly — it only inserts a job row.

### 3. Processing — `/api/cron/process-jobs`

Follows the existing Kubernetes CronJob pattern (identical to `cronjob-daily-summary.yaml`):

1. Claim up to 10 pending jobs: set `status='processing'`, increment `attempts`
2. Reset stuck `processing` jobs (older than 5 minutes) back to `pending`
3. For each claimed job, look up handler by `type` and invoke `handle(payload)`
4. On success: set `status='completed'`, `completed_at=now()`
5. On failure: if `attempts < maxAttempts`, reset to `pending`; else set `status='failed'` with error message

**Kubernetes CronJob:** Runs every minute, `curl -sf http://…/api/cron/process-jobs` — same pattern as daily-summary.

### 4. Error Handling & Retry

- `maxAttempts` defaults to 3. Each processing attempt increments `attempts`.
- On failure: `attempts < maxAttempts` → reset to `pending` (retry on next cycle). `attempts >= maxAttempts` → `status='failed'`, store error message in `error`.
- Stuck `processing` jobs (>5 min old): reset to `pending`, `attempts` unchanged.
- `error` field stores only the latest error message. No error accumulation.
- No exponential backoff. Jobs retry on the next CronJob cycle (~1 minute). Can be added later if needed.

### 5. Frontend — Submitting State

**`RequestForm.tsx` changes:**

- Add `const [submitting, setSubmitting] = useState(false)`
- Change `onSubmit` prop type from `(requestedBy: string) => void` to `(requestedBy: string) => Promise<void>`
- In `handleSubmit`: set `submitting = true`, `await onSubmit(requestedBy)`, `finally { setSubmitting(false) }`
- When `submitting` is true: render "Submitting..." + CSS spinner, hide the form
- On success: parent calls `setRequesting(null)` which unmounts the form
- On error: `finally` resets `submitting`, form reappears (name still populated from localStorage since we don't clear it until after success)

**`page.tsx` changes:**

- `handleMovieRequest`, `handleSeasonRequest`, `handleRequestAllSeasons` must propagate errors (remove catch-and-log-only; throw so the form can show the error state and reset)

**Item-level only.** Only the specific item being requested shows the spinner. Other search results remain interactive.

### Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `Job` model |
| `prisma/migrations/…` | New migration for `jobs` table |
| `src/lib/job-queue.ts` | New: handler registry, `processJob`, `registerJobType` |
| `src/lib/jobs/request-notification.ts` | New: `request_notification` handler (extracted from `notifications.ts`) |
| `src/lib/jobs/tv-series-request-notification.ts` | New: `tv_series_request_notification` handler |
| `src/lib/request-service.ts` | Replace `await sendRequestNotification()` with transactional job insert |
| `src/lib/notifications.ts` | Keep `buildRequestNotificationContent` / `buildDailySummaryContent` as pure functions; remove `sendRequestNotification` top-level call from `createRequest` flow |
| `src/app/api/cron/process-jobs/route.ts` | New: CronJob endpoint that claims and processes pending jobs |
| `helm/templates/cronjob-process-jobs.yaml` | New: CronJob manifest |
| `helm/templates/configmap.yaml` | Add process-jobs cron config |
| `src/components/RequestForm.tsx` | Add `submitting` state, spinner, await `onSubmit` |
| `src/app/page.tsx` | Update handlers to propagate errors |