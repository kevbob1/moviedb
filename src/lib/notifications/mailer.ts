import nodemailer from 'nodemailer';
import { RenderedEmail } from './renderers';

export type { RenderedEmail };

export interface MailerConfig {
  ok: boolean;
  reason?: 'smtp' | 'app_base_url';
}

export interface Mailer {
  isConfigured(): MailerConfig;
  send(msg: { to: string; from: string; message: RenderedEmail }): Promise<void>;
}

export class SmtpMailer implements Mailer {
  isConfigured(): MailerConfig {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to = process.env.NOTIFICATION_EMAIL;
    const baseUrl = process.env.APP_BASE_URL;

    if (!user || !pass || !to) return { ok: false, reason: 'smtp' };
    if (!baseUrl) return { ok: false, reason: 'app_base_url' };
    return { ok: true };
  }

  async send(msg: { to: string; from: string; message: RenderedEmail }): Promise<void> {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: msg.from,
      to: msg.to,
      subject: msg.message.subject,
      text: msg.message.text,
      html: msg.message.html,
    });
  }
}

export class InMemoryMailer implements Mailer {
  public sent: Array<{ to: string; from: string; message: RenderedEmail }> = [];
  private readonly configured: MailerConfig;

  constructor(init?: { ok?: boolean; reason?: 'smtp' | 'app_base_url' }) {
    this.configured = { ok: init?.ok ?? true, reason: init?.reason };
  }

  isConfigured(): MailerConfig {
    return { ...this.configured };
  }

  async send(msg: { to: string; from: string; message: RenderedEmail }): Promise<void> {
    this.sent.push({
      to: msg.to,
      from: msg.from,
      message: { ...msg.message },
    });
  }
}
