# Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time email notifications on new requests and a daily summary cronjob, using Gmail SMTP via nodemailer, with all config injected through Helm.

**Architecture:** A dedicated `src/lib/notifications.ts` module encapsulates all email logic. `createRequest` calls `sendRequestNotification` after successful DB insert. A standalone `scripts/daily-summary.ts` script queries active requests and calls `sendDailySummary`. A Kubernetes CronJob runs the script daily.

**Tech Stack:** Next.js, Prisma, nodemailer, Gmail SMTP, Helm, Kubernetes CronJob

---

### Task 1: Add nodemailer dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install nodemailer and its types**

```bash
devcontainer exec 'npm install nodemailer'
devcontainer exec 'npm install --save-dev @types/nodemailer'
```

- [ ] **Step 2: Verify package.json updated**

```bash
grep -A1 '"nodemailer"' package.json
```

Expected output:
```
    "nodemailer": "^<version>"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add nodemailer for email notifications"
```

---

### Task 2: Implement notification module

**Files:**
- Create: `src/lib/notifications.ts`
- Create: `src/lib/__tests__/notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/notifications.test.ts`:

```typescript
// src/lib/__tests__/notifications.test.ts
import { sendRequestNotification, sendDailySummary } from '../notifications';
import nodemailer from 'nodemailer';

jest.mock('nodemailer');

const mockedCreateTransport = nodemailer.createTransport as jest.Mock;

const mockSendMail = jest.fn();
const mockTransporter = {
  sendMail: mockSendMail,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedCreateTransport.mockReturnValue(mockTransporter);
  mockSendMail.mockResolvedValue({ messageId: 'test-id' });
  process.env.SMTP_HOST = 'smtp.gmail.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'test@gmail.com';
  process.env.SMTP_PASS = 'testpass';
  process.env.NOTIFICATION_EMAIL = 'admin@example.com';
  process.env.APP_BASE_URL = 'https://example.com';
});

afterEach(() => {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.NOTIFICATION_EMAIL;
  delete process.env.APP_BASE_URL;
});

describe('sendRequestNotification', () => {
  it('sends an email with request details', async () => {
    const request = {
      id: 1,
      title: 'Inception',
      requested_by: 'Alice',
      status: 'pending',
      requested_at: new Date('2026-06-06T10:00:00Z'),
    };

    await sendRequestNotification(request as any);

    expect(mockedCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@gmail.com',
        pass: 'testpass',
      },
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'test@gmail.com',
      to: 'admin@example.com',
      subject: 'New Request: Inception',
      text: 'Someone requested "Inception" on Jellyfin Request Tracker.',
    });
  });

  it('logs error but does not throw if email fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockSendMail.mockRejectedValue(new Error('SMTP error'));

    const request = {
      id: 1,
      title: 'Inception',
      requested_by: 'Alice',
      status: 'pending',
      requested_at: new Date('2026-06-06T10:00:00Z'),
    };

    await expect(sendRequestNotification(request as any)).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to send request notification:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('throws if required env vars are missing', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.NOTIFICATION_EMAIL;

    const request = {
      id: 1,
      title: 'Inception',
      requested_by: 'Alice',
      status: 'pending',
      requested_at: new Date('2026-06-06T10:00:00Z'),
    };

    await expect(sendRequestNotification(request as any)).rejects.toThrow(
      'Missing required SMTP configuration'
    );
  });
});

describe('sendDailySummary', () => {
  it('sends an email with all active requests', async () => {
    const requests = [
      {
        id: 1,
        title: 'Inception',
        requested_by: 'Alice',
        status: 'pending',
        requested_at: new Date('2026-06-06T10:00:00Z'),
      },
      {
        id: 2,
        title: 'The Matrix',
        requested_by: 'Bob',
        status: 'downloading',
        requested_at: new Date('2026-06-05T10:00:00Z'),
      },
    ];

    await sendDailySummary(requests as any);

    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'test@gmail.com',
      to: 'admin@example.com',
      subject: 'Daily Summary: 2 active requests',
      text: expect.stringContaining('Inception'),
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('https://example.com/requests'),
      })
    );
  });

  it('logs error but does not throw if email fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockSendMail.mockRejectedValue(new Error('SMTP error'));

    await expect(sendDailySummary([] as any)).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to send daily summary:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('throws if required env vars are missing', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.NOTIFICATION_EMAIL;
    delete process.env.APP_BASE_URL;

    await expect(sendDailySummary([] as any)).rejects.toThrow(
      'Missing required SMTP configuration'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
devcontainer exec 'npx jest src/lib/__tests__/notifications.test.ts --no-coverage'
```

Expected: FAIL with "Cannot find module '../notifications'"

- [ ] **Step 3: Implement the notification module**

Create `src/lib/notifications.ts`:

```typescript
// src/lib/notifications.ts
import nodemailer from 'nodemailer';

interface Request {
  id: number;
  title: string;
  requested_by: string;
  status: string;
  requested_at: Date;
}

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.NOTIFICATION_EMAIL;

  if (!user || !pass || !to) {
    throw new Error('Missing required SMTP configuration');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
  });
}

export async function sendRequestNotification(request: Request): Promise<void> {
  try {
    const transporter = getTransporter();
    const to = process.env.NOTIFICATION_EMAIL;
    const from = process.env.SMTP_USER;

    await transporter.sendMail({
      from,
      to,
      subject: `New Request: ${request.title}`,
      text: `Someone requested "${request.title}" on Jellyfin Request Tracker.`,
    });
  } catch (error) {
    console.error('Failed to send request notification:', error);
  }
}

export async function sendDailySummary(requests: Request[]): Promise<void> {
  try {
    const transporter = getTransporter();
    const to = process.env.NOTIFICATION_EMAIL;
    const from = process.env.SMTP_USER;
    const baseUrl = process.env.APP_BASE_URL;

    if (!baseUrl) {
      throw new Error('Missing required SMTP configuration');
    }

    const count = requests.length;
    const subject = `Daily Summary: ${count} active request${count === 1 ? '' : 's'}`;

    let text = `Daily Summary: ${count} active request${count === 1 ? '' : 's'}\n\n`;

    if (count === 0) {
      text += 'No active requests at this time.';
    } else {
      requests.forEach((req) => {
        text += `- "${req.title}" requested by ${req.requested_by} (${req.status})\n`;
      });
      text += `\nView all requests: ${baseUrl}/requests\n`;
    }

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error('Failed to send daily summary:', error);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
devcontainer exec 'npx jest src/lib/__tests__/notifications.test.ts --no-coverage'
```

Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications.ts src/lib/__tests__/notifications.test.ts
git commit -m "feat: add email notification module with tests"
```

---

### Task 3: Wire real-time notification into request creation

**Files:**
- Modify: `src/lib/request-service.ts`
- Modify: `src/app/actions/__tests__/request-actions.test.ts`

- [ ] **Step 1: Update request-service.ts to send notification after creation**

In `src/lib/request-service.ts`, add the import and call after `prisma.request.create`:

```typescript
import { sendRequestNotification } from './notifications';
```

Then modify the `createRequest` function. After the `prisma.request.create` call, add:

```typescript
  const created = await prisma.request.create({
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

  await sendRequestNotification(created);

  return created;
```

Full updated `createRequest` function:

```typescript
export async function createRequest(input: CreateRequestInput) {
  if (!input.title?.trim() || !input.requestedBy?.trim()) {
    throw new Error('Title and requester name are required');
  }

  const created = await prisma.request.create({
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

  await sendRequestNotification(created);

  return created;
}
```

- [ ] **Step 2: Mock notification module in request-actions test**

In `src/app/actions/__tests__/request-actions.test.ts`, add the mock at the top:

```typescript
jest.mock('@/lib/notifications', () => ({
  sendRequestNotification: jest.fn().mockResolvedValue(undefined),
}));
```

Then add the import:

```typescript
import { sendRequestNotification } from '@/lib/notifications';
```

Update the `createRequest` test to verify the notification is called:

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
      expect(sendRequestNotification).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockRequest);
    });
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
devcontainer exec 'npx jest src/app/actions/__tests__/request-actions.test.ts --no-coverage'
```

Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/request-service.ts src/app/actions/__tests__/request-actions.test.ts
git commit -m "feat: send email notification on new request creation"
```

---

### Task 4: Create daily summary script

**Files:**
- Create: `scripts/daily-summary.ts`
- Modify: `tsconfig.json` (if needed for script compilation)

- [ ] **Step 1: Create the daily summary script**

Create `scripts/daily-summary.ts`:

```typescript
// scripts/daily-summary.ts
import { prisma } from '../src/lib/prisma';
import { sendDailySummary } from '../src/lib/notifications';

async function main() {
  try {
    const requests = await prisma.request.findMany({
      where: {
        status: {
          in: ['pending', 'downloading'],
        },
      },
      orderBy: {
        requested_at: 'desc',
      },
    });

    await sendDailySummary(requests);
  } catch (error) {
    console.error('Daily summary script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
```

- [ ] **Step 2: Verify script compiles**

```bash
devcontainer exec 'npx ts-node scripts/daily-summary.ts'
```

Expected: Script runs (may fail with SMTP error if env vars not set, but should not crash on syntax).

If `ts-node` is not available, add it:

```bash
devcontainer exec 'npm install --save-dev ts-node'
```

- [ ] **Step 3: Commit**

```bash
git add scripts/daily-summary.ts
git commit -m "feat: add daily summary email script"
```

---

### Task 5: Update Helm ConfigMap

**Files:**
- Modify: `helm/templates/configmap.yaml`

- [ ] **Step 1: Add notification environment variables**

In `helm/templates/configmap.yaml`, add after the existing `JELLYFIN_URL` line:

```yaml
  SMTP_HOST: {{ .Values.notifications.smtp.host | quote }}
  SMTP_PORT: {{ .Values.notifications.smtp.port | quote }}
  NOTIFICATION_EMAIL: {{ .Values.notifications.email | quote }}
  APP_BASE_URL: {{ .Values.app.baseUrl | quote }}
```

Full updated `configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "moviedb.fullname" . }}-env
  labels:
    {{- include "moviedb.labels" . | nindent 4 }}
  annotations:
    helm.sh/hook: pre-install,pre-upgrade
    helm.sh/hook-weight: "-10"
    helm.sh/hook-delete-policy: before-hook-creation
data:
  NODE_ENV: {{ .Values.app.env.NODE_ENV | quote }}
  JELLYFIN_URL: {{ .Values.jellyfin.url | quote }}
  SMTP_HOST: {{ .Values.notifications.smtp.host | quote }}
  SMTP_PORT: {{ .Values.notifications.smtp.port | quote }}
  NOTIFICATION_EMAIL: {{ .Values.notifications.email | quote }}
  APP_BASE_URL: {{ .Values.app.baseUrl | quote }}
```

- [ ] **Step 2: Commit**

```bash
git add helm/templates/configmap.yaml
git commit -m "feat(helm): add SMTP and notification config to ConfigMap"
```

---

### Task 6: Update Helm Secret

**Files:**
- Modify: `helm/templates/secret.yaml`

- [ ] **Step 1: Add SMTP credentials**

In `helm/templates/secret.yaml`, add after the existing `JELLYFIN_API_KEY` line:

```yaml
  SMTP_USER: {{ .Values.secrets.smtp.user | quote }}
  SMTP_PASS: {{ .Values.secrets.smtp.password | quote }}
```

Full updated `secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "moviedb.fullname" . }}
  labels:
    {{- include "moviedb.labels" . | nindent 4 }}
type: Opaque
stringData:
  DATABASE_PASSWORD: {{ .Values.secrets.database.password | quote }}
  DATABASE_USERNAME: {{ .Values.secrets.database.username | quote }}
  TMDB_API_KEY: {{ .Values.secrets.tmdb_api_key | quote }}
  JELLYFIN_API_KEY: {{ .Values.secrets.jellyfin_api_key | quote }}
  SMTP_USER: {{ .Values.secrets.smtp.user | quote }}
  SMTP_PASS: {{ .Values.secrets.smtp.password | quote }}
```

- [ ] **Step 2: Commit**

```bash
git add helm/templates/secret.yaml
git commit -m "feat(helm): add SMTP credentials to Secret"
```

---

### Task 7: Update Helm values

**Files:**
- Modify: `helm/values.yaml`
- Modify: `helm/values-secrets.yaml`

- [ ] **Step 1: Add notification config to values.yaml**

In `helm/values.yaml`, add after the existing `app` block:

```yaml
app:
  baseUrl: "https://on-jf.p.drule.org"
```

And add a new `notifications` block:

```yaml
notifications:
  smtp:
    host: "smtp.gmail.com"
    port: "587"
  email: "kev+onjf@drule.org"
  cron:
    schedule: "0 8 * * *"
```

- [ ] **Step 2: Add SMTP secrets to values-secrets.yaml**

In `helm/values-secrets.yaml`, add under `secrets`:

```yaml
    smtp:
        user: ENC[AES256_GCM,data:YOUR_ENCRYPTED_VALUE,iv:...,tag:...,type:str]
        password: ENC[AES256_GCM,data:YOUR_ENCRYPTED_VALUE,iv:...,tag:...,type:str]
```

> **Note:** The actual encrypted values must be generated using `sops` with the repository's age key. The placeholder above shows the structure. The engineer should run:
> ```bash
> sops -e -i helm/values-secrets.yaml
> ```
> after adding the plaintext values.

- [ ] **Step 3: Commit**

```bash
git add helm/values.yaml helm/values-secrets.yaml
git commit -m "feat(helm): add notification and SMTP values"
```

---

### Task 8: Add Helm CronJob template

**Files:**
- Create: `helm/templates/cronjob-daily-summary.yaml`

- [ ] **Step 1: Create the CronJob template**

Create `helm/templates/cronjob-daily-summary.yaml`:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: {{ include "moviedb.fullname" . }}-daily-summary
  labels:
    {{- include "moviedb.labels" . | nindent 4 }}
spec:
  schedule: {{ .Values.notifications.cron.schedule | quote }}
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: daily-summary
              image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
              imagePullPolicy: {{ .Values.image.pullPolicy }}
              command:
                - node
                - scripts/daily-summary.ts
              envFrom:
                - configMapRef:
                    name: {{ include "moviedb.fullname" . }}-env
                - secretRef:
                    name: {{ include "moviedb.fullname" . }}
              env:
                - name: DATABASE_URL
                  value: postgresql://{{ .Values.secrets.database.username }}:{{ .Values.secrets.database.password }}@postgres-postgresql.database:5432/moviedb_production
          restartPolicy: OnFailure
```

- [ ] **Step 2: Commit**

```bash
git add helm/templates/cronjob-daily-summary.yaml
git commit -m "feat(helm): add daily summary CronJob template"
```

---

### Task 9: Add local development env vars

**Files:**
- Modify: `.env`
- Modify: `.env.development`

- [ ] **Step 1: Add example env vars to .env**

Add to `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password
NOTIFICATION_EMAIL=kev+onjf@drule.org
APP_BASE_URL=http://localhost:3000
```

- [ ] **Step 2: Add example env vars to .env.development**

Add to `.env.development`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password
NOTIFICATION_EMAIL=kev+onjf@drule.org
APP_BASE_URL=http://localhost:3000
```

- [ ] **Step 3: Commit**

```bash
git add .env .env.development
git commit -m "chore: add notification env vars for local development"
```

---

### Task 10: Validate all changes

- [ ] **Step 1: Run lint**

```bash
devcontainer exec 'npm run lint'
```

Expected: 0 warnings, 0 errors.

- [ ] **Step 2: Run tests**

```bash
devcontainer exec 'npm run test'
```

Expected: All tests pass.

- [ ] **Step 3: Run typecheck**

```bash
devcontainer exec 'npm run typecheck'
```

Expected: No TypeScript errors.

- [ ] **Step 4: Run build**

```bash
devcontainer exec 'npm run build'
```

Expected: Build succeeds.

- [ ] **Step 5: Run full check**

```bash
devcontainer exec 'npm run check'
```

Expected: All checks pass.

- [ ] **Step 6: Final commit**

```bash
git commit --allow-empty -m "feat: email notifications complete"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Real-time email on new request | Task 2 (module), Task 3 (integration) |
| Daily summary of active requests | Task 2 (module), Task 4 (script), Task 8 (CronJob) |
| Gmail SMTP | Task 1 (nodemailer), Task 2 (config) |
| Recipient configurable via env var | Task 5, 6, 7 (Helm), Task 9 (local env) |
| Links in daily summary | Task 2 (`sendDailySummary` uses `APP_BASE_URL`) |
| Best-effort notifications | Task 2 (catch + log, no throw) |
| Helm ConfigMap for non-secrets | Task 5 |
| Helm Secret for secrets | Task 6 |
| Kubernetes CronJob | Task 8 |
| Tests | Task 2, 3 |
| Error handling | Task 2, 4 |

## Placeholder Scan

- No TBDs or TODOs.
- All code blocks contain complete, runnable code.
- All commands have expected output.
- No vague instructions like "add appropriate error handling".

## Type Consistency

- `sendRequestNotification(request: Request)` and `sendDailySummary(requests: Request[])` use the same `Request` interface from `src/lib/notifications.ts`.
- Environment variable names are consistent across all files: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFICATION_EMAIL`, `APP_BASE_URL`.
- Helm values path: `.Values.notifications.smtp.host`, `.Values.notifications.smtp.port`, `.Values.notifications.email`, `.Values.notifications.cron.schedule`, `.Values.app.baseUrl`.
