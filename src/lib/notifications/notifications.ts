import { logger } from '@/lib/logger';
import { Mailer } from './mailer';
import {
  NotificationRequest,
  TvSeriesNotificationPayload,
  renderRequest,
  renderTvSeries,
  renderDailySummary,
} from './renderers';

export interface Notifications {
  sendRequest(payload: NotificationRequest): Promise<void>;
  sendTvSeries(payload: TvSeriesNotificationPayload): Promise<void>;
  sendDailySummary(requests: NotificationRequest[]): Promise<void>;
}

export interface NotificationsOpts {
  to?: string;
  from?: string;
  baseUrl?: string;
}

const KIND_LABELS = {
  request: 'request notification',
  tvSeries: 'TV series notification',
  dailySummary: 'daily summary',
} as const;

export function createNotifications(
  mailer: Mailer,
  opts: NotificationsOpts = {}
): Notifications {
  const to = opts.to ?? process.env.NOTIFICATION_EMAIL ?? '';
  const from = opts.from ?? process.env.SMTP_USER ?? '';
  const baseUrl = opts.baseUrl ?? process.env.APP_BASE_URL ?? '';

  async function dispatch(
    kind: keyof typeof KIND_LABELS,
    rendered: { subject: string; text: string; html: string }
  ): Promise<void> {
    const cfg = mailer.isConfigured();
    if (!cfg.ok) {
      logger.warn(
        `Skipping ${KIND_LABELS[kind]}: ${cfg.reason} not configured`
      );
      return;
    }
    try {
      await mailer.send({ to, from, message: rendered });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error({ err: error }, `Failed to send ${KIND_LABELS[kind]}`);
    }
  }

  return {
    async sendRequest(payload) {
      const rendered = renderRequest(payload, baseUrl);
      await dispatch('request', rendered);
    },
    async sendTvSeries(payload) {
      const rendered = renderTvSeries(payload, baseUrl);
      await dispatch('tvSeries', rendered);
    },
    async sendDailySummary(requests) {
      const rendered = renderDailySummary(requests, baseUrl);
      await dispatch('dailySummary', rendered);
    },
  };
}
