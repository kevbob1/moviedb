// src/lib/notifications.ts
import nodemailer from 'nodemailer';

export interface NotificationRequest {
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

export async function sendRequestNotification(request: NotificationRequest): Promise<void> {
  const transporter = getTransporter();
  const to = process.env.NOTIFICATION_EMAIL;
  const from = process.env.SMTP_USER;

  try {
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

export async function sendDailySummary(requests: NotificationRequest[]): Promise<void> {
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

  try {
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
