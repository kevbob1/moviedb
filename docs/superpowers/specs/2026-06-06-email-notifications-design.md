# Email Notifications for Movie Requests

## Overview

Add email notifications to the MovieDB app so that the admin receives a real-time alert when someone adds a new movie request, and a daily summary of all active requests.

## Goals

- Send a real-time email notification when a new request is created.
- Send a daily summary email of all active (pending + downloading) requests.
- Use Gmail SMTP for sending emails.
- Make recipient configurable via environment variable, injected through Helm.
- Include links to requests in the daily summary email.
- Notifications must be best-effort (failures do not block the request creation).

## Non-Goals

- No SMS, WhatsApp, or Google Voice integration.
- No retry logic for failed notifications.
- No notification preferences or user opt-out.
- No in-app notification UI or notification history.

## Context

The MovieDB app is a Next.js + Postgres application that tracks movie requests for Jellyfin. Users submit requests via a web UI, and the app stores them in a Postgres database via Prisma.

The current `Request` model includes: `title`, `requested_by`, `status`, `requested_at`, etc.

The request creation flow is:

1. User submits a request via `createRequest` server action.
2. `createRequest` calls `createRequestImpl` in `src/lib/request-service.ts`.
3. The request is persisted to the database.

## Architecture

### Notification Module

A new `src/lib/notifications.ts` module will encapsulate all email logic.

```typescript
// src/lib/notifications.ts
export async function sendRequestNotification(request: Request): Promise<void>
export async function sendDailySummary(requests: Request[]): Promise<void>
```

- Uses `nodemailer` with Gmail SMTP.
- Reads configuration from environment variables.
- Both functions are best-effort: they log errors but never throw.

### Real-Time Notification

- `createRequest` in `src/lib/request-service.ts` calls `sendRequestNotification` after successful database insertion.
- If the email fails, the request is still created and the error is logged.

### Daily Summary CronJob

- A standalone script `scripts/daily-summary.ts` queries Prisma for all active requests (`pending` + `downloading`).
- It calls `sendDailySummary(requests)` from `src/lib/notifications.ts`.
- A Kubernetes CronJob runs this script daily.

### Email Content

**Real-time notification:**
- Subject: `New Request: {title}`
- Body: `Someone requested '{title}' on Jellyfin Request Tracker.`

**Daily summary:**
- Subject: `Daily Summary: {N} active requests`
- Body: A list of all active requests. Each request shows title, requester, and a link to the requests page (`{APP_BASE_URL}/requests`). Since the app does not have individual request detail pages, all links point to the list page.

## Data Flow

### Real-Time Notification

```
User submits request
  -> createRequest server action
    -> createRequestImpl (src/lib/request-service.ts)
      -> prisma.request.create
      -> sendRequestNotification (src/lib/notifications.ts)
        -> nodemailer -> Gmail SMTP -> Admin inbox
```

### Daily Summary

```
Kubernetes CronJob triggers
  -> node scripts/daily-summary.ts
    -> prisma.request.findMany({ status: { in: ['pending', 'downloading'] } })
    -> sendDailySummary (src/lib/notifications.ts)
      -> nodemailer -> Gmail SMTP -> Admin inbox
```

## Environment Variables

Following the project's Helm conventions (ConfigMap for non-secrets, Secret for secrets):

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `SMTP_HOST` | ConfigMap | `smtp.gmail.com` | SMTP server host |
| `SMTP_PORT` | ConfigMap | `587` | SMTP server port |
| `NOTIFICATION_EMAIL` | ConfigMap | `kev+onjf@drule.org` | Recipient email address |
| `APP_BASE_URL` | ConfigMap | `https://on-jf.p.drule.org` | Base URL for request links |
| `SMTP_USER` | Secret | — | Gmail SMTP username |
| `SMTP_PASS` | Secret | — | Gmail SMTP password (app-specific password) |

## Helm Chart Changes

### ConfigMap (`templates/configmap.yaml`)

Add the following entries to the existing ConfigMap:

```yaml
SMTP_HOST: {{ .Values.notifications.smtp.host | quote }}
SMTP_PORT: {{ .Values.notifications.smtp.port | quote }}
NOTIFICATION_EMAIL: {{ .Values.notifications.email | quote }}
APP_BASE_URL: {{ .Values.app.baseUrl | quote }}
```

### Secret (`templates/secret.yaml`)

Add the following entries to the existing Secret:

```yaml
SMTP_USER: {{ .Values.secrets.smtp.user | quote }}
SMTP_PASS: {{ .Values.secrets.smtp.password | quote }}
```

### Values (`values.yaml`)

Add the following configuration:

```yaml
app:
  baseUrl: "https://on-jf.p.drule.org"

notifications:
  smtp:
    host: "smtp.gmail.com"
    port: "587"
  email: "kev+onjf@drule.org"
```

### Values-Secrets (`values-secrets.yaml`)

Add the following entries under `secrets`:

```yaml
smtp:
  user: "your-gmail-address@gmail.com"
  password: "your-app-specific-password"
```

### CronJob (`templates/cronjob-daily-summary.yaml`)

Create a new Kubernetes CronJob resource:

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

### Values Update for CronJob

Add cron schedule to `values.yaml`:

```yaml
notifications:
  cron:
    schedule: "0 8 * * *"
```

## Error Handling

- **Real-time notification**: If `sendRequestNotification` fails, log the error and continue. The request creation must never fail because of a notification failure.
- **Daily summary**: If `sendDailySummary` fails, log the error. The CronJob should still exit with code 0 to avoid Kubernetes retry loops.

## Testing

- Unit tests for `sendRequestNotification` and `sendDailySummary` using a mocked nodemailer transporter.
- Integration test for `createRequest` verifying that `sendRequestNotification` is called after successful creation.
- Test that notification failures do not throw or block the main flow.

## Dependencies

- `nodemailer` (new package)
- `@types/nodemailer` (dev dependency)

## Files to Create/Modify

### New Files

- `src/lib/notifications.ts` — Email notification module
- `scripts/daily-summary.ts` — Daily summary script
- `src/lib/notifications.test.ts` — Tests for notification module
- `helm/templates/cronjob-daily-summary.yaml` — CronJob template

### Modified Files

- `src/lib/request-service.ts` — Add `sendRequestNotification` call after `createRequest`
- `helm/templates/configmap.yaml` — Add SMTP and notification config
- `helm/templates/secret.yaml` — Add SMTP credentials
- `helm/values.yaml` — Add notification and cron settings
- `helm/values-secrets.yaml` — Add SMTP secrets
- `package.json` — Add `nodemailer` and `@types/nodemailer`

## Migration / Rollout

1. Add `nodemailer` dependency.
2. Implement `src/lib/notifications.ts`.
3. Update `src/lib/request-service.ts` to call `sendRequestNotification`.
4. Create `scripts/daily-summary.ts`.
5. Add Helm templates and values.
6. Update `.env` / `.env.development` with example values for local development.
7. Run `npm run check` to validate.
