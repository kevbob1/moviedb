// src/lib/notifications.ts
import nodemailer from 'nodemailer';
import { logger } from './logger';

export interface NotificationRequest {
  id: number;
  title: string;
  requested_by: string;
  status: string;
  requested_at: Date;
  release_date?: string | null;
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

function getYear(releaseDate?: string | null): string {
  if (!releaseDate) return 'Unknown';
  const match = releaseDate.match(/^(\d{4})(?:[-/T]|$)/);
  if (match) return match[1];
  const year = new Date(releaseDate).getFullYear();
  return isNaN(year) ? 'Unknown' : String(year);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildRequestNotificationContent(
  request: NotificationRequest,
  baseUrl: string
): { text: string; html: string; subject: string } {
  const year = getYear(request.release_date);
  const requestUrl = `${baseUrl}/requests/${encodeURIComponent(request.id)}`;
  const subject = `[JELLYFIN REQUEST] New Request: ${request.title} (${year})`;

  const text = `A new media request has been submitted.

Requestor: ${request.requested_by}
Movie: ${request.title}
Year: ${year}

View request: ${requestUrl}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Request: ${escapeHtml(request.title)}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <h2 style="color: #2c3e50;">New Media Request</h2>
  <p>A new media request has been submitted.</p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Requestor:</td>
      <td style="padding: 8px 0;">${escapeHtml(request.requested_by)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Movie:</td>
      <td style="padding: 8px 0; font-size: 1.2em; font-weight: bold;">${escapeHtml(request.title)}</td>
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
    <a href="${requestUrl}">${escapeHtml(requestUrl)}</a>
  </p>
</body>
</html>`;

  return { text, html, subject };
}

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

  const encodedListUrl = encodeURI(listUrl);

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
      const requestUrl = `${baseUrl}/requests/${encodeURIComponent(req.id)}`;
      html += `<li style="margin: 8px 0;">
        <strong>${escapeHtml(req.title)}</strong> (${year}) — 
        requested by ${escapeHtml(req.requested_by)} (${escapeHtml(req.status)}) 
        <a href="${requestUrl}">View</a>
      </li>`;
    });
    html += '</ul>';
  }

  html += `<p style="margin-top: 24px;">
    <a href="${encodedListUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px;">View All Requests</a>
  </p>
  <p style="color: #666; font-size: 0.9em;">
    <a href="${encodedListUrl}">${escapeHtml(listUrl)}</a>
  </p>
</body>
</html>`;

  return { text, html, subject };
}

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
  const { text, html, subject } = buildRequestNotificationContent(request, baseUrl);

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
