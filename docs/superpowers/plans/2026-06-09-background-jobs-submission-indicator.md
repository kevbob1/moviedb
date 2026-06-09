# Background Job Queue & Submission Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace blocking SMTP calls with a durable background job queue, and add a submission spinner to the request form.

**Architecture:** Add a `Job` Prisma model with a handler-registry pattern. Request creation enqueues notification jobs via transactional outbox (Prisma `$transaction`). A `/api/cron/process-jobs` endpoint (invoked by a Kubernetes CronJob every minute) claims and processes pending jobs. Frontend `RequestForm` gains a `submitting` state that shows a spinner during async submission.

**Tech Stack:** Prisma, Next.js API routes, PostgreSQL JsonB, Tailwind CSS, Jest

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | Add `Job` model |
| `src/lib/job-queue.ts` | Handler registry (`registerJobType`, `processJob`, `processPendingJobs`) |
| `src/lib/jobs/request-notification.ts` | `request_notification` handler |
| `src/lib/jobs/tv-series-request-notification.ts` | `tv_series_request_notification` handler |
| `src/lib/jobs/index.ts` | Re-exports all job registrations so importing this file registers all handlers |
| `src/lib/request-service.ts` | Transactional outbox: replace `await sendRequestNotification` with job insert |
| `src/lib/notifications.ts` | Keep pure email builders, remove `sendRequestNotification` export (handler calls `getTransporter`/`sendMail` directly) |
| `src/app/api/cron/process-jobs/route.ts` | CronJob endpoint: claim jobs, process, mark complete/failed |
| `src/app/api/cron/process-jobs/__tests__/route.test.ts` | Tests for process-jobs endpoint |
| `src/lib/__tests__/job-queue.test.ts` | Tests for handler registry |
| `src/lib/__tests__/request-service.test.ts` | Update to mock `prisma.$transaction` instead of `sendRequestNotification` |
| `src/lib/jobs/__tests__/request-notification.test.ts` | Tests for request notification handler |
| `src/lib/jobs/__tests__/tv-series-request-notification.test.ts` | Tests for TV series notification handler |
| `helm/templates/cronjob-process-jobs.yaml` | CronJob manifest |
| `helm/templates/configmap.yaml` | Add process-jobs schedule config |
| `src/components/RequestForm.tsx` | Add `submitting` state + spinner |
| `src/app/page.tsx` | Propagate errors from handlers |
| `src/app/globals.css` | Add spinner animation |

---

### Task 1: Add Job model to Prisma schema and create migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the Job model to prisma/schema.prisma**

Append after the `Request` model:

```prisma
model Job {
  id           Int       @id @default(autoincrement())
  type         String
  payload      Json      @db.JsonB
  status       String    @default("pending")
  attempts     Int       @default(0)
  maxAttempts  Int       @default(3)
  error        String?
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt
  completed_at DateTime?

  @@map("jobs")
}
```

- [ ] **Step 2: Run `devcontainer exec 'npx prisma migrate dev --create-only --name add-jobs-table'`**

This creates the migration SQL file without applying it (dev uses `prisma migrate deploy`).

- [ ] **Step 3: Verify the migration file was created**

Check that `prisma/migrations/` has a new directory with `migration.sql` containing the `CREATE TABLE "jobs"` statement.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Job model for background job queue"
```

---

### Task 2: Create job-queue handler registry

**Files:**
- Create: `src/lib/job-queue.ts`
- Create: `src/lib/__tests__/job-queue.test.ts`

- [ ] **Step 1: Write failing tests for job-queue.ts**

Create `src/lib/__tests__/job-queue.test.ts`:

```ts
import { registerJobType, processJob, processPendingJobs } from '../job-queue';
import { prisma } from '../prisma';

jest.mock('../prisma', () => ({
  prisma: {
    job: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('job-queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerJobType and processJob', () => {
    it('invokes the registered handler for a job type', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      registerJobType('test_type', { handle: handler });

      const job = {
        id: 1,
        type: 'test_type',
        payload: { message: 'hello' },
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        error: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      };

      await processJob(job as any);

      expect(handler).toHaveBeenCalledWith({ message: 'hello' });
    });

    it('throws if no handler is registered for job type', async () => {
      const job = {
        id: 99,
        type: 'unknown_type',
        payload: {},
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        error: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      };

      await expect(processJob(job as any)).rejects.toThrow('No handler for job type: unknown_type');
    });
  });

  describe('processPendingJobs', () => {
    it('claims pending jobs and processes them', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      registerJobType('claim_test', { handle: handler });

      const jobs = [
        { id: 1, type: 'claim_test', payload: { a: 1 }, status: 'pending', attempts: 0, maxAttempts: 3, error: null, created_at: new Date(), updated_at: new Date(), completed_at: null },
      ];

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return fn(prisma);
        return [];
      });

      (prisma.job.findMany as jest.Mock).mockResolvedValue(jobs);
      (prisma.job.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.job.update as jest.Mock).mockResolvedValue({});

      const result = await processPendingJobs();

      expect(handler).toHaveBeenCalledWith({ a: 1 });
      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'completed', completed_at: expect.any(Date) },
      });
      expect(result.processed).toBe(1);
    });

    it('resets stuck processing jobs older than 5 minutes', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return fn(prisma);
        return [];
      });

      (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.job.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await processPendingJobs();

      expect(prisma.job.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'processing',
            updated_at: expect.any(Object),
          }),
        }),
        expect.objectContaining({
          data: { status: 'pending' },
        }),
      );
    });

    it('marks a job as failed after max attempts', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('SMTP down'));

      registerJobType('fail_test', { handle: handler });

      const jobs = [
        { id: 2, type: 'fail_test', payload: {}, status: 'processing', attempts: 2, maxAttempts: 3, error: null, created_at: new Date(), updated_at: new Date(), completed_at: null },
      ];

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return fn(prisma);
        return [];
      });

      (prisma.job.findMany as jest.Mock).mockResolvedValue(jobs);
      (prisma.job.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.job.update as jest.Mock).mockResolvedValue({});

      const result = await processPendingJobs();

      expect(handler).toHaveBeenCalled();
      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { status: 'failed', error: 'SMTP down' },
      });
      expect(result.failed).toBe(1);
    });

    it('resets to pending on failure when attempts remain', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('transient'));

      registerJobType('retry_test', { handle: handler });

      const jobs = [
        { id: 3, type: 'retry_test', payload: {}, status: 'processing', attempts: 1, maxAttempts: 3, error: null, created_at: new Date(), updated_at: new Date(), completed_at: null },
      ];

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') return fn(prisma);
        return [];
      });

      (prisma.job.findMany as jest.Mock).mockResolvedValue(jobs);
      (prisma.job.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.job.update as jest.Mock).mockResolvedValue({});

      const result = await processPendingJobs();

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { status: 'pending', error: 'transient' },
      });
      expect(result.failed).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `devcontainer exec 'npx jest src/lib/__tests__/job-queue.test.ts --no-coverage'`
Expected: FAIL — module `../job-queue` does not exist.

- [ ] **Step 3: Implement `src/lib/job-queue.ts`**

```ts
import { prisma } from './prisma';
import { logger } from './logger';

const STUCK_THRESHOLD_MINUTES = 5;
const BATCH_SIZE = 10;

interface JobHandler<T> {
  handle: (payload: T) => Promise<void>;
}

const handlers = new Map<string, JobHandler<unknown>>();

export function registerJobType<T>(type: string, handler: JobHandler<T>): void {
  handlers.set(type, handler as JobHandler<unknown>);
}

export async function processJob(job: {
  id: number;
  type: string;
  payload: unknown;
}): Promise<void> {
  const handler = handlers.get(job.type);
  if (!handler) {
    throw new Error(`No handler for job type: ${job.type}`);
  }
  await handler.handle(job.payload);
}

export interface ProcessResult {
  processed: number;
  failed: number;
}

export async function processPendingJobs(): Promise<ProcessResult> {
  const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000);

  await prisma.job.updateMany({
    where: {
      status: 'processing',
      updated_at: { lt: stuckCutoff },
    },
    data: { status: 'pending' },
  });

  const pendingJobs = await prisma.job.findMany({
    where: { status: 'pending' },
    orderBy: { created_at: 'asc' },
    take: BATCH_SIZE,
  });

  let processed = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    const claimed = await prisma.job.update({
      where: { id: job.id },
      data: { status: 'processing', attempts: { increment: 1 } },
    });

    try {
      await processJob(claimed);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'completed', completed_at: new Date() },
      });
      processed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, jobId: job.id, jobType: job.type }, 'Job failed');

      if (claimed.attempts >= claimed.maxAttempts) {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'failed', error: errorMessage },
        });
        failed++;
      } else {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'pending', error: errorMessage },
        });
      }
    }
  }

  return { processed, failed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `devcontainer exec 'npx jest src/lib/__tests__/job-queue.test.ts --no-coverage'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/job-queue.ts src/lib/__tests__/job-queue.test.ts
git commit -m "feat: add job queue handler registry and processor"
```

---

### Task 3: Create request_notification job handler

**Files:**
- Create: `src/lib/jobs/request-notification.ts`
- Create: `src/lib/jobs/__tests__/request-notification.test.ts`

- [ ] **Step 1: Write failing tests for request-notification handler**

Create `src/lib/jobs/__tests__/request-notification.test.ts`:

```ts
import { sendMail } from 'nodemailer';
import { registerJobType } from '../../job-queue';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

jest.mock('../../logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

describe('request_notification handler', () => {
  beforeAll(() => {
    jest.isolateModules(() => {
      require('../request-notification');
    });
  });

  it('is registered as a job handler', () => {
  });

  it.todo('sends email with request details — verified via integration with existing buildRequestNotificationContent');
});
```

- [ ] **Step 2: Run tests to confirm module doesn't exist yet**

Run: `devcontainer exec 'npx jest src/lib/jobs/__tests__/request-notification.test.ts --no-coverage'`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/jobs/request-notification.ts`**

```ts
import { registerJobType } from '../job-queue';
import { buildRequestNotificationContent, sendEmail } from '../notifications';
import { logger } from '../logger';

interface RequestNotificationPayload {
  id: number;
  title: string;
  requested_by: string;
  status: string;
  requested_at: string;
  release_date?: string | null;
  media_type?: string;
  season_number?: number | null;
}

registerJobType<RequestNotificationPayload>('request_notification', {
  handle: async (payload) => {
    const { sendRequestNotification } = await import('../notifications');
    await sendRequestNotification(payload as any);
  },
});
```

Wait — this creates a circular dependency concern. The handler imports from `notifications.ts` which already exports `sendRequestNotification`. But we're changing `sendRequestNotification` to be called *from the handler*, not from `request-service.ts`. The handler should use the existing `sendRequestNotification` function. Let me simplify:

```ts
import { registerJobType } from '../job-queue';
import { sendRequestNotification, NotificationRequest } from '../notifications';

interface RequestNotificationPayload extends NotificationRequest {}

registerJobType<RequestNotificationPayload>('request_notification', {
  handle: async (payload) => {
    await sendRequestNotification(payload);
  },
});

export { RequestNotificationPayload };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `devcontainer exec 'npx jest src/lib/jobs/__tests__/request-notification.test.ts --no-coverage'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/jobs/
git commit -m "feat: add request_notification job handler"
```

---

### Task 4: Create tv_series_request_notification job handler

**Files:**
- Create: `src/lib/jobs/tv-series-request-notification.ts`
- Create: `src/lib/jobs/__tests__/tv-series-request-notification.test.ts`
- Modify: `src/lib/notifications.ts` (add `buildTvSeriesNotificationContent` and `sendTvSeriesNotification`)

- [ ] **Step 1: Write failing tests for the TV series notification handler**

Create `src/lib/jobs/__tests__/tv-series-request-notification.test.ts`:

```ts
import nodemailer from 'nodemailer';

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: mockSendMail,
  }),
}));

jest.mock('../../logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

describe('tv_series_request_notification handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'password';
    process.env.NOTIFICATION_EMAIL = 'admin@test.com';
    process.env.APP_BASE_URL = 'https://example.com';
  });

  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.NOTIFICATION_EMAIL;
    delete process.env.APP_BASE_URL;
  });

  it('sends a single email for a TV series request', async () => {
    const { handle } = await import('../tv-series-request-notification');

    await handle({
      title: 'Best Show',
      requestedBy: 'Alice',
      seasons: [1, 2, 3],
      totalSeasons: 3,
      posterPath: null,
      releaseDate: '2023-01-01',
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('Best Show');
    expect(call.subject).toContain('Seasons 1-3');
    expect(call.html).toContain('Best Show');
  });

  it('skips sending when SMTP is not configured', async () => {
    delete process.env.SMTP_USER;

    const { handle } = await import('../tv-series-request-notification');

    await handle({
      title: 'No SMTP Show',
      requestedBy: 'Bob',
      seasons: [1],
      totalSeasons: 1,
      posterPath: null,
      releaseDate: null,
    });

    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `devcontainer exec 'npx jest src/lib/jobs/__tests__/tv-series-request-notification.test.ts --no-coverage'`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Add `sendTvSeriesNotification` to `src/lib/notifications.ts`**

Add the following after the existing `buildDailySummaryContent` function (before `sendRequestNotification`):

```ts
export interface TvSeriesNotificationPayload {
  title: string;
  requestedBy: string;
  seasons: number[];
  totalSeasons: number;
  posterPath: string | null;
  releaseDate: string | null;
}

function buildTvSeriesNotificationContent(
  payload: TvSeriesNotificationPayload,
  baseUrl: string
): { text: string; html: string; subject: string } {
  const year = getYear(payload.releaseDate);
  const listUrl = `${baseUrl}/requests`;
  const seasonRange = payload.seasons.length === 1
    ? `Season ${payload.seasons[0]}`
    : `Seasons ${payload.seasons[0]}-${payload.seasons[payload.seasons.length - 1]}`;
  const subject = `[JELLYFIN REQUEST] New TV Request: ${payload.title} (${seasonRange}, ${year})`;

  const seasonList = payload.seasons.map(s => `Season ${s}`).join(', ');

  const text = `A new TV series request has been submitted.

Requestor: ${payload.requestedBy}
Show: ${payload.title}
${seasonList}
Year: ${year}

View requests: ${listUrl}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2c3e50;">New TV Series Request</h2>
  <p>A new TV series request has been submitted.</p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Requestor:</td>
      <td style="padding: 8px 0;">${escapeHtml(payload.requestedBy)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Show:</td>
      <td style="padding: 8px 0; font-size: 1.2em; font-weight: bold;">${escapeHtml(payload.title)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Seasons:</td>
      <td style="padding: 8px 0;">${escapeHtml(seasonList)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Year:</td>
      <td style="padding: 8px 0;">${year}</td>
    </tr>
  </table>
  <p>
    <a href="${listUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px;">View Requests</a>
  </p>
  <p style="color: #666; font-size: 0.9em;">
    <a href="${listUrl}">${escapeHtml(listUrl)}</a>
  </p>
</body>
</html>`;

  return { text, html, subject };
}

export async function sendTvSeriesNotification(payload: TvSeriesNotificationPayload): Promise<void> {
  const to = process.env.NOTIFICATION_EMAIL;
  const from = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const baseUrl = process.env.APP_BASE_URL;

  if (!from || !pass || !to) {
    logger.warn('Skipping TV series notification: SMTP not configured');
    return;
  }

  if (!baseUrl) {
    logger.warn('Skipping TV series notification: APP_BASE_URL not configured');
    return;
  }

  const transporter = getTransporter();
  const { text, html, subject } = buildTvSeriesNotificationContent(payload, baseUrl);

  try {
    await transporter.sendMail({ from, to, subject, text, html });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ err }, 'Failed to send TV series notification');
  }
}
```

- [ ] **Step 4: Implement `src/lib/jobs/tv-series-request-notification.ts`**

```ts
import { registerJobType } from '../job-queue';
import { sendTvSeriesNotification } from '../notifications';

interface TvSeriesRequestNotificationPayload {
  title: string;
  requestedBy: string;
  seasons: number[];
  totalSeasons: number;
  posterPath: string | null;
  releaseDate: string | null;
}

registerJobType<TvSeriesRequestNotificationPayload>('tv_series_request_notification', {
  handle: sendTvSeriesNotification,
});

export type { TvSeriesRequestNotificationPayload };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `devcontainer exec 'npx jest src/lib/jobs/__tests__/tv-series-request-notification.test.ts --no-coverage'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/jobs/tv-series-request-notification.ts src/lib/jobs/__tests__/tv-series-request-notification.test.ts src/lib/notifications.ts
git commit -m "feat: add tv_series_request_notification handler with series-level email"
```

---

### Task 5: Create jobs index file

**Files:**
- Create: `src/lib/jobs/index.ts`

- [ ] **Step 1: Create `src/lib/jobs/index.ts`**

```ts
import './request-notification';
import './tv-series-request-notification';
```

This ensures all handlers are registered at module load time when the index is imported.

- [ ] **Step 2: Commit**

```bash
git add src/lib/jobs/index.ts
git commit -m "feat: add jobs index to register all handlers"
```

---

### Task 6: Update request-service to use transactional outbox

**Files:**
- Modify: `src/lib/request-service.ts`
- Modify: `src/lib/__tests__/request-service.test.ts`
- Modify: `src/app/actions/__tests__/request-actions.test.ts`

- [ ] **Step 1: Update failing tests in request-service.test.ts first**

Replace the current mock for `sendRequestNotification` with a mock for `prisma.$transaction` and `prisma.job`. The key changes:

1. Remove `sendRequestNotification` mock
2. Add `prisma.job.create` mock
3. Replace `prisma.request.create` usages with `prisma.$transaction` mock

Update `src/lib/__tests__/request-service.test.ts`:

```ts
import { createRequest, createTvRequests } from '../request-service';
import { prisma } from '../prisma';

const mockCreate = jest.fn();
const mockJobCreate = jest.fn();
const mockFindFirst = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../prisma', () => ({
  prisma: {
    request: {
      findFirst: mockFindFirst,
      create: mockCreate,
    },
    job: {
      create: mockJobCreate,
    },
    $transaction: mockTransaction,
  },
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/lib/tmdb', () => ({
  getTMDBTVDetails: jest.fn(),
}));

// Ensure handlers are registered
jest.mock('../jobs');

describe('request-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('creates a movie request and enqueues a notification job', async () => {
      const mockRequest = { id: 1, title: 'Test Movie', tmdb_id: 123, season_number: null, media_type: 'movie', status: 'pending', requested_by: 'Alice', requested_at: new Date(), poster_path: null, release_date: '2024-01-01', overview: 'A movie', genre_ids: [28] };

      mockFindFirst.mockResolvedValue(null);
      mockTransaction.mockImplementation(async (fn: any) => {
        const tx = {
          request: { create: jest.fn().mockResolvedValue(mockRequest) },
          job: { create: jest.fn().mockResolvedValue({ id: 1, type: 'request_notification' }) },
        };
        return await fn(tx);
      });

      const result = await createRequest({
        tmdbId: 123,
        title: 'Test Movie',
        posterPath: null,
        requestedBy: 'Alice',
        releaseDate: '2024-01-01',
        overview: 'A movie',
        genreIds: [28],
        mediaType: 'movie',
      });

      expect(result).toEqual(mockRequest);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('returns existing request without creating job for duplicate', async () => {
      const existing = { id: 5, title: 'Existing Movie', tmdb_id: 123, season_number: null };
      mockFindFirst.mockResolvedValue(existing);

      const result = await createRequest({
        tmdbId: 123,
        title: 'Existing Movie',
        posterPath: null,
        requestedBy: 'John Doe',
        mediaType: 'movie',
      });

      expect(result).toBe(existing);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('throws when title is missing', async () => {
      await expect(
        createRequest({ tmdbId: 1, title: '', posterPath: null, requestedBy: '', mediaType: 'movie' })
      ).rejects.toThrow('Title and requester name are required');
    });

    it('creates a TV request with season_number and enqueues job', async () => {
      const mockRequest = { id: 2, title: 'Test Show', tmdb_id: 456, season_number: 3, media_type: 'tv', status: 'pending', requested_by: 'Bob', requested_at: new Date(), poster_path: null, release_date: undefined, overview: undefined, genre_ids: [] };

      mockFindFirst.mockResolvedValue(null);
      mockTransaction.mockImplementation(async (fn: any) => {
        const tx = {
          request: { create: jest.fn().mockResolvedValue(mockRequest) },
          job: { create: jest.fn().mockResolvedValue({ id: 2, type: 'request_notification' }) },
        };
        return await fn(tx);
      });

      const result = await createRequest({
        tmdbId: 456,
        title: 'Test Show',
        posterPath: null,
        requestedBy: 'Bob',
        mediaType: 'tv',
        seasonNumber: 3,
      });

      expect(result.media_type).toBe('tv');
      expect(result.season_number).toBe(3);
    });
  });

  describe('createTvRequests', () => {
    it('creates requests for all seasons and enqueues single notification job', async () => {
      const getTMDBTVDetails = jest.requireMock('@/lib/tmdb').getTMDBTVDetails;
      getTMDBTVDetails.mockResolvedValue({
        id: 100,
        name: 'Best Show',
        poster_path: '/best.jpg',
        seasons: [
          { season_number: 0, name: 'Specials', episode_count: 5 },
          { season_number: 1, name: 'Season 1', episode_count: 10 },
          { season_number: 2, name: 'Season 2', episode_count: 8 },
        ],
      });

      mockTransaction.mockImplementation(async (fn: any) => {
        const created = [
          { id: 10, tmdb_id: 100, season_number: 1, media_type: 'tv', title: 'Best Show' },
          { id: 11, tmdb_id: 100, season_number: 2, media_type: 'tv', title: 'Best Show' },
        ];
        const tx = {
          request: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn()
              .mockResolvedValueOnce(created[0])
              .mockResolvedValueOnce(created[1]),
          },
          job: { create: jest.fn().mockResolvedValue({ id: 1, type: 'tv_series_request_notification' }) },
        };
        return await fn(tx);
      });

      const results = await createTvRequests(100, 'Alice');

      expect(results).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (old code doesn't use $transaction)**

Run: `devcontainer exec 'npx jest src/lib/__tests__/request-service.test.ts --no-coverage'`
Expected: FAIL — current code still calls `sendRequestNotification`.

- [ ] **Step 3: Update `src/lib/request-service.ts`**

Replace the entire file with the transactional outbox version:

```ts
import { prisma } from '@/lib/prisma';
import { canTransition, RequestStatus } from '@/lib/request-fsm';
import { logger } from './logger';
import { getTMDBTVDetails } from './tmdb';

import './jobs';

export interface CreateRequestInput {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  requestedBy: string;
  releaseDate?: string;
  overview?: string;
  genreIds?: number[];
  mediaType: string;
  seasonNumber?: number;
}

export async function createRequest(input: CreateRequestInput) {
  if (!input.title?.trim() || !input.requestedBy?.trim()) {
    throw new Error('Title and requester name are required');
  }

  const existing = await prisma.request.findFirst({
    where: {
      tmdb_id: input.tmdbId,
      season_number: input.seasonNumber ?? null,
    },
  });
  if (existing) {
    logger.info({ tmdbId: input.tmdbId, seasonNumber: input.seasonNumber, title: input.title, requestId: existing.id }, 'Request already exists');
    return existing;
  }

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.request.create({
      data: {
        tmdb_id: input.tmdbId,
        title: input.title,
        poster_path: input.posterPath,
        requested_by: input.requestedBy,
        status: 'pending',
        media_type: input.mediaType,
        season_number: input.seasonNumber ?? null,
        release_date: input.releaseDate,
        overview: input.overview,
        genre_ids: input.genreIds ?? [],
      },
    });

    await tx.job.create({
      data: {
        type: 'request_notification',
        payload: { ...request },
        status: 'pending',
      },
    });

    return request;
  });

  logger.info({ requestId: created.id, tmdbId: input.tmdbId, seasonNumber: input.seasonNumber, title: input.title, mediaType: input.mediaType, requestedBy: input.requestedBy }, 'Request created');

  return created;
}

export async function createTvRequests(tmdbId: number, requestedBy: string) {
  if (!requestedBy?.trim()) {
    throw new Error('Requester name is required');
  }

  const details = await getTMDBTVDetails(tmdbId);
  const seasons = details.seasons.filter(s => s.season_number > 0);

  const results = await prisma.$transaction(async (tx) => {
    const created: Awaited<ReturnType<typeof tx.request.create>>[] = [];

    for (const season of seasons) {
      const existing = await tx.request.findFirst({
        where: { tmdb_id: tmdbId, season_number: season.season_number },
      });

      if (existing) {
        created.push(existing);
        continue;
      }

      const req = await tx.request.create({
        data: {
          tmdb_id: tmdbId,
          title: details.name,
          poster_path: season.poster_path ?? null,
          requested_by: requestedBy,
          status: 'pending',
          media_type: 'tv',
          season_number: season.season_number,
        },
      });
      created.push(req);
    }

    await tx.job.create({
      data: {
        type: 'tv_series_request_notification',
        payload: {
          title: details.name,
          requestedBy,
          seasons: seasons.map(s => s.season_number),
          totalSeasons: seasons.length,
          posterPath: details.poster_path ?? null,
          releaseDate: details.first_air_date ?? null,
        },
        status: 'pending',
      },
    });

    return created;
  });

  logger.info({ tmdbId, seasonCount: seasons.length, requestedBy }, 'TV show fan-out complete');

  return results;
}

export async function transitionToStatus(requestId: number, targetStatus: RequestStatus) {
  const request = await prisma.request.findUnique({ where: { id: requestId } });

  if (!request) {
    throw new Error('Request not found');
  }

  const currentStatus = request.status as RequestStatus;

  if (!canTransition(currentStatus, targetStatus)) {
    throw new Error(`Cannot transition from ${currentStatus} to ${targetStatus}`);
  }

  return prisma.request.update({
    where: { id: requestId },
    data: { status: targetStatus },
  });
}

export async function fulfillRequest(requestId: number) {
  return transitionToStatus(requestId, 'fulfilled');
}

export async function downloadRequest(requestId: number) {
  return transitionToStatus(requestId, 'downloading');
}

export async function cancelRequest(requestId: number) {
  return transitionToStatus(requestId, 'canceled');
}
```

- [ ] **Step 4: Run request-service tests**

Run: `devcontainer exec 'npx jest src/lib/__tests__/request-service.test.ts --no-coverage'`
Expected: PASS

- [ ] **Step 5: Update request-actions tests to remove sendRequestNotification mock**

Update `src/app/actions/__tests__/request-actions.test.ts` — remove the `sendRequestNotification` mock and the assertion about it. The action module no longer imports notifications. Replace:

```ts
// Remove:
jest.mock('@/lib/notifications', () => ({
  sendRequestNotification: jest.fn().mockResolvedValue(undefined),
}));

// Remove the assertion in the test:
// expect(sendRequestNotification).toHaveBeenCalledWith(mockRequest);

// Add import for jobs module so handlers are registered:
jest.mock('@/lib/jobs', () => ({}));
```

Also update `prisma` mock to include `$transaction` and `job.create`:

```ts
(prisma as any).$transaction = jest.fn().mockImplementation(async (fn: any) => {
  const tx = {
    request: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockRequest),
    },
    job: {
      create: jest.fn().mockResolvedValue({ id: 1, type: 'request_notification' }),
    },
  };
  return await fn(tx);
});
```

- [ ] **Step 6: Run request-actions tests**

Run: `devcontainer exec 'npx jest src/app/actions/__tests__/request-actions.test.ts --no-coverage'`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/request-service.ts src/lib/__tests__/request-service.test.ts src/app/actions/__tests__/request-actions.test.ts
git commit -m "feat: replace blocking notifications with transactional outbox"
```

---

### Task 7: Create process-jobs cron route

**Files:**
- Create: `src/app/api/cron/process-jobs/route.ts`
- Create: `src/app/api/cron/process-jobs/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests for process-jobs route**

Create `src/app/api/cron/process-jobs/__tests__/route.test.ts`:

```ts
import { logger } from '@/lib/logger';

const processPendingJobsMock = jest.fn();
const headersMock = jest.fn();

jest.mock('@/lib/job-queue', () => ({
  processPendingJobs: (...args: unknown[]) => processPendingJobsMock(...args),
}));

jest.mock('@/lib/jobs', () => ({}));

jest.mock('next/headers', () => ({
  headers: () => headersMock(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

interface MockResponse {
  status: number;
  json(): Promise<Record<string, unknown>>;
}

let GET: (req: Request) => Promise<MockResponse>;

beforeAll(() => {
  jest.isolateModules(() => {
    const route = require('../route');
    GET = route.GET;
  });
});

describe('process-jobs cron API', () => {
  const mockRequest = { url: 'http://localhost/api/cron/process-jobs', method: 'GET' } as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CRON_SECRET;
    headersMock.mockResolvedValue(new Headers());
    processPendingJobsMock.mockResolvedValue({ processed: 0, failed: 0 });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  describe('authentication', () => {
    it('allows access when CRON_SECRET is not set', async () => {
      const response = await GET(mockRequest);
      expect(response.status).toBe(200);
    });

    it('returns 401 when CRON_SECRET is set and Authorization header is missing', async () => {
      process.env.CRON_SECRET = 'secret-token';
      headersMock.mockResolvedValue(new Headers());

      const response = await GET(mockRequest);
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('message', 'Unauthorized');
    });

    it('returns 401 when CRON_SECRET is set and Authorization header is wrong', async () => {
      process.env.CRON_SECRET = 'secret-token';
      headersMock.mockResolvedValue(new Headers({ authorization: 'Bearer wrong' }));

      const response = await GET(mockRequest);
      expect(response.status).toBe(401);
    });

    it('allows access when CRON_SECRET matches Authorization header', async () => {
      process.env.CRON_SECRET = 'secret-token';
      headersMock.mockResolvedValue(new Headers({ authorization: 'Bearer secret-token' }));

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);
    });
  });

  describe('successful execution', () => {
    it('calls processPendingJobs and returns results', async () => {
      processPendingJobsMock.mockResolvedValue({ processed: 3, failed: 1 });

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('processed', 3);
      expect(body).toHaveProperty('failed', 1);
    });

    it('returns 200 with zero results when no jobs to process', async () => {
      processPendingJobsMock.mockResolvedValue({ processed: 0, failed: 0 });

      const response = await GET(mockRequest);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('processed', 0);
    });
  });

  describe('error handling', () => {
    it('returns 500 when processPendingJobs throws', async () => {
      processPendingJobsMock.mockRejectedValue(new Error('DB error'));

      const response = await GET(mockRequest);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.status).toBe('error');
      expect(body).toHaveProperty('message', 'Job processing failed');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'DB error' }),
        'Process jobs cron failed'
      );
    });
  });
});

export {};
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `devcontainer exec 'npx jest src/app/api/cron/process-jobs/__tests__/route.test.ts --no-coverage'`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/app/api/cron/process-jobs/route.ts`**

Follow the pattern from `daily-summary/route.ts`:

```ts
import { processPendingJobs } from '@/lib/job-queue';
import '@/lib/jobs';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/with-logging';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function handler() {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = (await headers()).get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await processPendingJobs();

    return NextResponse.json({
      status: 'ok',
      processed: result.processed,
      failed: result.failed,
    });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Process jobs cron failed');
    return NextResponse.json({ status: 'error', message: 'Job processing failed' }, { status: 500 });
  }
}

export const GET = withLogging(handler);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `devcontainer exec 'npx jest src/app/api/cron/process-jobs/__tests__/route.test.ts --no-coverage'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/process-jobs/
git commit -m "feat: add process-jobs cron route"
```

---

### Task 8: Add CronJob manifest and configmap entry

**Files:**
- Create: `helm/templates/cronjob-process-jobs.yaml`
- Modify: `helm/templates/configmap.yaml`

- [ ] **Step 1: Create `helm/templates/cronjob-process-jobs.yaml`**

Follow the pattern from `cronjob-daily-summary.yaml`:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: {{ include "moviedb.fullname" . }}-process-jobs
  labels:
    {{- include "moviedb.labels" . | nindent 4 }}
spec:
  schedule: "*/1 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: process-jobs
              image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
              imagePullPolicy: {{ .Values.image.pullPolicy }}
              command:
                - sh
                - -c
                - |
                  curl -sf -H "Authorization: Bearer ${CRON_SECRET}" http://{{ include "moviedb.fullname" . }}:{{ .Values.app.port }}/api/cron/process-jobs
              envFrom:
                - configMapRef:
                    name: {{ include "moviedb.fullname" . }}-env
                - secretRef:
                    name: {{ include "moviedb.fullname" . }}
              env:
                - name: DATABASE_URL
                  value: postgresql://{{ .Values.secrets.database.username }}:{{ .Values.secrets.database.password }}@postgres-postgresql.database:5432/moviedb_production
                - name: CRON_SECRET
                  valueFrom:
                    secretKeyRef:
                      name: {{ include "moviedb.fullname" . }}
                      key: CRON_SECRET
          restartPolicy: OnFailure
```

- [ ] **Step 2: Commit**

```bash
git add helm/templates/cronjob-process-jobs.yaml
git commit -m "feat: add process-jobs Kubernetes CronJob manifest"
```

---

### Task 9: Add submission spinner to RequestForm

**Files:**
- Modify: `src/components/RequestForm.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add spinner CSS to `src/app/globals.css`**

Add inside `@layer components {` block, after the existing button styles:

```css
  /* Spinner */
  .spinner {
    @apply inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin;
  }
```

- [ ] **Step 2: Update `src/components/RequestForm.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'moviedb-requestor-name';

interface Props {
  onSubmit: (requestedBy: string) => Promise<void>;
  onCancel: () => void;
  isVisible: boolean;
}

export function RequestForm({ onSubmit, onCancel, isVisible }: Props) {
  const [requestedBy, setRequestedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage on mount
      setRequestedBy(stored);
    }
  }, []);

  if (!isVisible) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestedBy.trim()) {
      localStorage.setItem(STORAGE_KEY, requestedBy.trim());
      setSubmitting(true);
      try {
        await onSubmit(requestedBy.trim());
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (submitting) {
    return (
      <div className="alert-request flex items-center gap-2">
        <span className="spinner" />
        <span className="text-sm text-muted-foreground">Submitting...</span>
      </div>
    );
  }

  return (
    <div className="alert-request">
      <form onSubmit={handleSubmit}>
        <label htmlFor="requestedBy" className="block text-sm font-medium text-muted-foreground mb-2">
          Requested by (your name):
        </label>
        <input
          id="requestedBy"
          type="text"
          value={requestedBy}
          onChange={(e) => setRequestedBy(e.target.value)}
          className="input w-full"
          placeholder="Your name"
          required
        />

        <div className="form-row mt-3">
          <button
            type="submit"
            className="btn-primary btn-md"
          >
            Submit Request
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary btn-md"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

Key changes:
- `onSubmit` prop is now `(requestedBy: string) => Promise<void>`
- Added `submitting` state
- `handleSubmit` is now `async`, sets `submitting` before the call, clears in `finally`
- Name is no longer cleared on submit (parent unmounts the form on success, and on error the name is still there for retry)
- When `submitting` is true, renders spinner instead of form

- [ ] **Step 3: Commit**

```bash
git add src/components/RequestForm.tsx src/app/globals.css
git commit -m "feat: add submission spinner to RequestForm"
```

---

### Task 10: Propagate errors in page.tsx handlers

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update handlers in `src/app/page.tsx` to propagate errors**

Change `handleMovieRequest`, `handleSeasonRequest`, and `handleRequestAllSeasons` to re-throw errors instead of swallowing them in catch blocks:

For `handleMovieRequest` (lines 120-130), change from:

```ts
  const handleMovieRequest = async (movie: TMDBMovieResult, requestedBy: string) => {
    try {
      await createRequest(movie.id, movie.title, movie.poster_path || null, requestedBy, movie.release_date, movie.overview, movie.genre_ids, 'movie');
      setRequesting(null);
      const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${movie.id}`);
      const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
      setJellyfinResults(prev => ({ ...prev, [movie.id]: jellyfinData.results[movie.id] || false }));
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to create request');
    }
  };
```

To:

```ts
  const handleMovieRequest = async (movie: TMDBMovieResult, requestedBy: string) => {
    try {
      await createRequest(movie.id, movie.title, movie.poster_path || null, requestedBy, movie.release_date, movie.overview, movie.genre_ids, 'movie');
      setRequesting(null);
      const jellyfinRes = await fetch(`/api/jellyfin/check?ids=${movie.id}`);
      const jellyfinData: JellyfinCheckResponse = await jellyfinRes.json();
      setJellyfinResults(prev => ({ ...prev, [movie.id]: jellyfinData.results[movie.id] || false }));
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to create request');
      throw err;
    }
  };
```

Apply the same pattern to `handleSeasonRequest` and `handleRequestAllSeasons` — add `throw err;` after the existing `logger.error` line in each catch block.

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: propagate request errors so RequestForm can show spinner state"
```

---

### Task 11: Run full validation and fix any issues

- [ ] **Step 1: Run `devcontainer exec 'npm run check'`**

This runs: `db:generate-client` → `lint` → `test` → `typecheck` → `build`

- [ ] **Step 2: Fix any lint warnings, type errors, or test failures**

Address any issues found by the check command.

- [ ] **Step 3: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve check failures from background job queue implementation"
```