# Email Format Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update notification emails to send multipart (text + HTML), prefix subjects with `[JELLYFIN REQUEST]`, show release year prominently, and include direct links to requests.

**Architecture:** Private template helper functions inside `src/lib/notifications.ts` generate `text` and `html` strings. The existing `sendMail` calls receive both fields. No new dependencies.

**Tech Stack:** TypeScript, Node.js, nodemailer, Jest

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/notifications.ts` | Modify | Add template helpers, update email functions |
| `src/lib/__tests__/notifications.test.ts` | Modify | Update tests for new format |

---

### Task 1: Update `NotificationRequest` interface

**Files:**
- Modify: `src/lib/notifications.ts:5-11`

- [ ] **Step 1: Add `release_date` to interface**

```typescript
export interface NotificationRequest {
  id: number;
  title: string;
  requested_by: string;
  status: string;
  requested_at: Date;
  release_date?: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: add release_date to NotificationRequest interface"
```

---

### Task 2: Add template helper functions

**Files:**
- Modify: `src/lib/notifications.ts` (after `getTransporter`, before `sendRequestNotification`)

- [ ] **Step 1: Add helper to extract year from release_date**

```typescript
function getYear(releaseDate?: string | null): string {
  if (!releaseDate) return 'Unknown';
  const year = new Date(releaseDate).getFullYear();
  return isNaN(year) ? 'Unknown' : String(year);
}
```

- [ ] **Step 2: Add template helper for request notification**

```typescript
function buildRequestNotificationContent(
  request: NotificationRequest,
  baseUrl: string
): { text: string; html: string } {
  const year = getYear(request.release_date);
  const requestUrl = `${baseUrl}/requests/${request.id}`;

  const text = `A new media request has been submitted.

Requestor: ${request.requested_by}
Movie: ${request.title}
Year: ${year}

View request: ${requestUrl}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Request: ${request.title}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2c3e50;">New Media Request</h2>
  <p>A new media request has been submitted.</p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Requestor:</td>
      <td style="padding: 8px 0;">${request.requested_by}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Movie:</td>
      <td style="padding: 8px 0; font-size: 1.2em; font-weight: bold;">${request.title}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Year:</td>
      <td style="padding: 8px 0;">${year}</td>
    </tr>
  </table>
  <p>
    <a href="${requestUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px;">View Request</a>
  </p>
  <p style="color: #666; font-size: 0.9em;">
    <a href="${requestUrl}">${requestUrl}</a>
  </p>
</body>
</html>`;

  return { text, html };
}
```

- [ ] **Step 3: Add template helper for daily summary**

```typescript
function buildDailySummaryContent(
  requests: NotificationRequest[],
  baseUrl: string
): { text: string; html: string; subject: string } {
  const count = requests.length;
  const subject = `[JELLYFIN REQUEST] Daily Summary: ${count} active request${count === 1 ? '' : 's'}`;
  const listUrl = `${baseUrl}/requests`;

  let text = `Daily Summary: ${count} active request${count === 1 ? '' : 's'}\n\n`;

  if (count === 0) {
    text += 'No active requests at this time.';
  } else {
    requests.forEach((req) => {
      const year = getYear(req.release_date);
      text += `- "${req.title}" (${year}) — requested by ${req.requested_by} (${req.status})\n`;
    });
    text += `\nView all requests: ${listUrl}`;
  }

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Daily Summary</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2c3e50;">Daily Summary</h2>
  <p>${count} active request${count === 1 ? '' : 's'}.</p>`;

  if (count === 0) {
    html += '<p>No active requests at this time.</p>';
  } else {
    html += '<ul style="padding-left: 20px;">';
    requests.forEach((req) => {
      const year = getYear(req.release_date);
      const requestUrl = `${baseUrl}/requests/${req.id}`;
      html += `<li style="margin: 8px 0;">
        <strong>${req.title}</strong> (${year}) — 
        requested by ${req.requested_by} (${req.status}) 
        <a href="${requestUrl}">View</a>
      </li>`;
    });
    html += '</ul>';
  }

  html += `<p style="margin-top: 24px;">
    <a href="${listUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px;">View All Requests</a>
  </p>
  <p style="color: #666; font-size: 0.9em;">
    <a href="${listUrl}">${listUrl}</a>
  </p>
</body>
</html>`;

  return { text, html, subject };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: add email template helper functions"
```

---

### Task 3: Update `sendRequestNotification`

**Files:**
- Modify: `src/lib/notifications.ts:32-55`

- [ ] **Step 1: Update function to require APP_BASE_URL and use templates**

Replace the entire `sendRequestNotification` function with:

```typescript
export async function sendRequestNotification(request: NotificationRequest): Promise<void> {
  const to = process.env.NOTIFICATION_EMAIL;
  const from = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const baseUrl = process.env.APP_BASE_URL;

  if (!from || !pass || !to) {
    logger.warn('Skipping request notification: SMTP not configured');
    return;
  }

  if (!baseUrl) {
    logger.warn('Skipping request notification: APP_BASE_URL not configured');
    return;
  }

  const transporter = getTransporter();
  const year = getYear(request.release_date);
  const subject = `[JELLYFIN REQUEST] New Request: ${request.title} (${year})`;
  const { text, html } = buildRequestNotificationContent(request, baseUrl);

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ err }, 'Failed to send request notification');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: update sendRequestNotification with multipart email and links"
```

---

### Task 4: Update `sendDailySummary`

**Files:**
- Modify: `src/lib/notifications.ts:57-100`

- [ ] **Step 1: Update function to use templates**

Replace the entire `sendDailySummary` function with:

```typescript
export async function sendDailySummary(requests: NotificationRequest[]): Promise<void> {
  const to = process.env.NOTIFICATION_EMAIL;
  const from = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const baseUrl = process.env.APP_BASE_URL;

  if (!from || !pass || !to) {
    logger.warn('Skipping daily summary: SMTP not configured');
    return;
  }

  if (!baseUrl) {
    logger.warn('Skipping daily summary: APP_BASE_URL not configured');
    return;
  }

  const transporter = getTransporter();
  const { text, html, subject } = buildDailySummaryContent(requests, baseUrl);

  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error({ err }, 'Failed to send daily summary');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: update sendDailySummary with multipart email and year display"
```

---

### Task 5: Update tests

**Files:**
- Modify: `src/lib/__tests__/notifications.test.ts`

- [ ] **Step 1: Update test data to include `release_date`**

Add `release_date: '2010-07-16'` to the first request object and `release_date: '1999-03-31'` to the second.

- [ ] **Step 2: Update `sendRequestNotification` test assertions**

In the first `sendRequestNotification` test, update the `expect(mockSendMail)` assertion to:

```typescript
expect(mockSendMail).toHaveBeenCalledWith({
  from: 'test@gmail.com',
  to: 'admin@example.com',
  subject: '[JELLYFIN REQUEST] New Request: Inception (2010)',
  text: expect.stringContaining('Requestor: Alice'),
  html: expect.stringContaining('Inception'),
});
```

- [ ] **Step 3: Add test for missing `APP_BASE_URL` in `sendRequestNotification`**

Add a new test:

```typescript
it('returns gracefully if APP_BASE_URL is missing', async () => {
  delete process.env.APP_BASE_URL;

  const request = {
    id: 1,
    title: 'Inception',
    requested_by: 'Alice',
    status: 'pending',
    requested_at: new Date('2026-06-06T10:00:00Z'),
    release_date: '2010-07-16',
  };

  await expect(sendRequestNotification(request as NotificationRequest)).resolves.not.toThrow();
  expect(logger.warn).toHaveBeenCalledWith('Skipping request notification: APP_BASE_URL not configured');
});
```

- [ ] **Step 4: Update `sendDailySummary` test assertions**

In the first `sendDailySummary` test, update the `expect(mockSendMail)` assertions to:

```typescript
expect(mockSendMail).toHaveBeenCalledWith({
  from: 'test@gmail.com',
  to: 'admin@example.com',
  subject: '[JELLYFIN REQUEST] Daily Summary: 2 active requests',
  text: expect.stringContaining('Inception (2010)'),
  html: expect.stringContaining('Inception'),
});
expect(mockSendMail).toHaveBeenCalledWith(
  expect.objectContaining({
    text: expect.stringContaining('https://example.com/requests'),
  })
);
```

- [ ] **Step 5: Run tests**

```bash
npm run test -- src/lib/__tests__/notifications.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/__tests__/notifications.test.ts
git commit -m "test: update notification tests for multipart email and year display"
```

---

### Task 6: Validation

- [ ] **Step 1: Run full validation suite**

```bash
npm run check
```

Expected: All checks pass (0 lint warnings, 0 test failures, typecheck passes, build succeeds).

- [ ] **Step 2: Commit any fixes if needed**

If validation found issues, fix them and commit.

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Multipart emails (text + HTML) | Task 2 (helpers), Task 3, Task 4 |
| `[JELLYFIN REQUEST]` subject prefix | Task 3, Task 4 |
| Movie title and year prominent | Task 2 (helpers) |
| Direct link to request | Task 2 (helpers), Task 3, Task 4 |
| `release_date` on `NotificationRequest` | Task 1 |
| Both email functions require `APP_BASE_URL` | Task 3, Task 4 |
| Updated tests | Task 5 |

## Placeholder Scan

- No TBD/TODO/fill-in-later references.
- All code blocks contain complete, copy-pasteable implementations.
- All test assertions use concrete expected values.
- All commands include expected output descriptions.

## Type Consistency Check

- `NotificationRequest.release_date` is `string | null | undefined` throughout.
- `getYear()` accepts `string | null | undefined` and returns `string`.
- Template helpers return `{ text: string; html: string }` (summary adds `subject: string`).
- `sendMail` calls always pass `from`, `to`, `subject`, `text`, `html`.
