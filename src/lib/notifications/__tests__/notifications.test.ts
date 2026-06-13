import { createNotifications } from '../notifications';
import { InMemoryMailer } from '../mailer';
import { logger } from '@/lib/logger';
import { NotificationRequest, TvSeriesNotificationPayload } from '../renderers';

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

function makeMailer(): InMemoryMailer {
  return new InMemoryMailer();
}

const baseOpts = { to: 'admin@example.com', from: 'a@example.com', baseUrl: 'https://example.com' };

describe('Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendRequest', () => {
    it('calls mailer.send once with rendered email', async () => {
      const mailer = makeMailer();
      const n = createNotifications(mailer, baseOpts);
      const req: NotificationRequest = {
        id: 1, title: 'Inception', requested_by: 'Alice', status: 'pending',
        requested_at: new Date('2026-06-06T10:00:00Z'), release_date: '2010-07-16',
      };
      await n.sendRequest(req);
      expect(mailer.sent).toHaveLength(1);
      const msg = mailer.sent[0];
      expect(msg.to).toBe('admin@example.com');
      expect(msg.from).toBe('a@example.com');
      expect(msg.message.subject).toContain('Inception');
      expect(msg.message.text).toContain('Alice');
      expect(msg.message.html).toContain('Inception');
    });

    it('escapes html in title, requester, status', async () => {
      const mailer = makeMailer();
      const n = createNotifications(mailer, baseOpts);
      await n.sendRequest({
        id: 1, title: '<x>', requested_by: 'A & B', status: 's<t',
        requested_at: new Date(), release_date: '2010-07-16',
      });
      expect(mailer.sent[0].message.html).toContain('&lt;x&gt;');
      expect(mailer.sent[0].message.html).toContain('A &amp; B');
      expect(mailer.sent[0].message.html).toContain('s&lt;t');
    });

    it.each([
      ['2010-07-16', '2010'],
      [null, 'Unknown'],
      [undefined, 'Unknown'],
      ['not-a-date', 'Unknown'],
    ])('handles release_date %p → year %p', async (release_date, expectedYear) => {
      const mailer = makeMailer();
      const n = createNotifications(mailer, baseOpts);
      await n.sendRequest({
        id: 1, title: 'X', requested_by: 'A', status: 'p',
        requested_at: new Date(), release_date: release_date as string | null,
      });
      expect(mailer.sent[0].message.text).toContain(`Year: ${expectedYear}`);
    });

    it('does NOT throw when mailer.send rejects; logs an error', async () => {
      const mailer = makeMailer();
      mailer.send = jest.fn().mockRejectedValueOnce(new Error('SMTP error'));
      const n = createNotifications(mailer, baseOpts);
      await expect(n.sendRequest({
        id: 1, title: 'X', requested_by: 'A', status: 'p',
        requested_at: new Date(), release_date: '2010-07-16',
      })).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.objectContaining({ message: 'SMTP error' }) }),
        'Failed to send request notification'
      );
    });

    it('is a no-op when mailer is not configured; logs a warn with the kind', async () => {
      const mailer = new InMemoryMailer({ ok: false, reason: 'smtp' });
      const n = createNotifications(mailer, baseOpts);
      await n.sendRequest({
        id: 1, title: 'X', requested_by: 'A', status: 'p',
        requested_at: new Date(), release_date: '2010-07-16',
      });
      expect(mailer.sent).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith('Skipping request notification: smtp not configured');
    });

    it('is a no-op when mailer not configured for app_base_url', async () => {
      const mailer = new InMemoryMailer({ ok: false, reason: 'app_base_url' });
      const n = createNotifications(mailer, baseOpts);
      await n.sendRequest({
        id: 1, title: 'X', requested_by: 'A', status: 'p',
        requested_at: new Date(), release_date: '2010-07-16',
      });
      expect(mailer.sent).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith('Skipping request notification: app_base_url not configured');
    });
  });

  describe('sendTvSeries', () => {
    const basePayload: TvSeriesNotificationPayload = {
      title: 'Best Show', requestedBy: 'Alice', seasons: [1, 2, 3],
      totalSeasons: 3, posterPath: null, releaseDate: '2023-01-01',
    };

    it('sends one email for the TV series payload', async () => {
      const mailer = makeMailer();
      const n = createNotifications(mailer, baseOpts);
      await n.sendTvSeries(basePayload);
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0].message.subject).toContain('Seasons 1-3');
    });

    it('does NOT throw when mailer.send rejects', async () => {
      const mailer = makeMailer();
      mailer.send = jest.fn().mockRejectedValueOnce(new Error('SMTP error'));
      const n = createNotifications(mailer, baseOpts);
      await expect(n.sendTvSeries(basePayload)).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.anything(),
        'Failed to send TV series notification'
      );
    });

    it('is a no-op when mailer is not configured', async () => {
      const mailer = new InMemoryMailer({ ok: false, reason: 'smtp' });
      const n = createNotifications(mailer, baseOpts);
      await n.sendTvSeries(basePayload);
      expect(mailer.sent).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith('Skipping TV series notification: smtp not configured');
    });
  });

  describe('sendDailySummary', () => {
    const reqs: NotificationRequest[] = [
      { id: 1, title: 'Inception', requested_by: 'Alice', status: 'pending', requested_at: new Date(), release_date: '2010-07-16' },
    ];

    it('sends one email summarizing requests', async () => {
      const mailer = makeMailer();
      const n = createNotifications(mailer, baseOpts);
      await n.sendDailySummary(reqs);
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0].message.subject).toContain('1 active request');
    });

    it('handles empty array by rendering No active requests', async () => {
      const mailer = makeMailer();
      const n = createNotifications(mailer, baseOpts);
      await n.sendDailySummary([]);
      expect(mailer.sent[0].message.text).toContain('No active requests at this time.');
      expect(mailer.sent[0].message.html).toContain('No active requests at this time.');
    });

    it('does NOT throw when mailer.send rejects', async () => {
      const mailer = makeMailer();
      mailer.send = jest.fn().mockRejectedValueOnce(new Error('SMTP error'));
      const n = createNotifications(mailer, baseOpts);
      await expect(n.sendDailySummary([])).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.anything(),
        'Failed to send daily summary'
      );
    });

    it('is a no-op when mailer is not configured', async () => {
      const mailer = new InMemoryMailer({ ok: false, reason: 'smtp' });
      const n = createNotifications(mailer, baseOpts);
      await n.sendDailySummary(reqs);
      expect(mailer.sent).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith('Skipping daily summary: smtp not configured');
    });
  });
});
