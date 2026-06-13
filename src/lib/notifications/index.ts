import { createNotifications, Notifications } from './notifications';
import { SmtpMailer, InMemoryMailer, Mailer, MailerConfig, RenderedEmail } from './mailer';
import { NotificationRequest, TvSeriesNotificationPayload } from './renderers';

export type { Notifications, Mailer, MailerConfig, RenderedEmail, NotificationRequest, TvSeriesNotificationPayload };
export { createNotifications, SmtpMailer, InMemoryMailer };

const defaultNotifications = createNotifications(new SmtpMailer());

export const sendRequest = (payload: NotificationRequest) => defaultNotifications.sendRequest(payload);
export const sendTvSeries = (payload: TvSeriesNotificationPayload) => defaultNotifications.sendTvSeries(payload);
export const sendDailySummary = (requests: NotificationRequest[]) => defaultNotifications.sendDailySummary(requests);
