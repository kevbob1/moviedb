# Email Format Improvements Design

## Overview

Improve the format and detail of email notifications sent by the Jellyfin Request Tracker.

## Goals

- Send multipart emails (text + HTML) instead of plain text only.
- Make the movie title and release year more obvious.
- Prefix every subject with `[JELLYFIN REQUEST]`.
- Include a direct link to the request in every email.

## Current State

`src/lib/notifications.ts` uses `nodemailer` to send two kinds of emails:

1. `sendRequestNotification(request)` — sent when a new request is created.
2. `sendDailySummary(requests)` — sent by a cron job summarizing active requests.

Both currently send **plain text only** with minimal formatting and no deep links.

## Proposed Design

### Architecture

- **No new files or dependencies.**
- **Private template helper functions** inside `src/lib/notifications.ts` will generate the `text` and `html` strings.
- The existing `sendMail` calls stay intact; they will simply receive both `text` and `html` fields instead of only `text`.
- The `NotificationRequest` interface gets extended with `release_date?: string | null` so templates can extract the year.
- Both email functions now require `APP_BASE_URL`. If it's missing, they log a warning and skip gracefully (same pattern `sendDailySummary` already uses).

### `sendRequestNotification`

- **Subject**: `[JELLYFIN REQUEST] New Request: {title} ({year})`
  - Example: `[JELLYFIN REQUEST] New Request: Inception (2010)`
- **Text body**:
  ```
  A new media request has been submitted.

  Requestor: {requested_by}
  Movie: {title}
  Year: {year}

  View request: {APP_BASE_URL}/requests/{id}
  ```
- **HTML body**: Simple styled HTML with a large, prominent movie title, year in parentheses, requestor info, and a direct link to `/requests/{id}`.

### `sendDailySummary`

- **Subject**: `[JELLYFIN REQUEST] Daily Summary: {count} active request(s)`
- **Text body**: Bulleted list of each request including title, year, requestor, and status. Ends with a link to the full list.
  ```
  Daily Summary: 3 active requests

  - Inception (2010) — requested by Alice (pending)
  - The Matrix (1999) — requested by Bob (downloading)

  View all requests: {APP_BASE_URL}/requests
  ```
- **HTML body**: Clean HTML list/table showing title, year, requestor, status, and a per-request link, plus a link to the full `/requests` page.

### Error Handling & Testing

- Existing `try/catch` and `logger` behavior stays exactly the same.
- Tests in `src/lib/__tests__/notifications.test.ts` get updated to assert that `sendMail` receives both `text` and `html`, and that subjects contain `[JELLYFIN REQUEST]`, the release year, and correct links.

## Future Considerations

- If more email types are added, consider extracting templates to a dedicated `src/lib/email-templates.ts` module.
- If templates become complex, a lightweight template engine (e.g., Handlebars) could be introduced, but it is unnecessary for the current two email types.
