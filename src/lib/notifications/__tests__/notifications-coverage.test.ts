import { InMemoryMailer } from '../mailer';
import { createNotifications } from '../notifications';
import {
  NotificationRequest,
  renderDailySummary,
  renderRequest,
} from '../renderers';

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const request: NotificationRequest = {
  id: 7,
  title: 'Inception',
  requested_by: 'Alice',
  status: 'pending',
  requested_at: new Date('2026-01-01T00:00:00Z'),
  release_date: '2010-07-16',
};

describe('notifications without explicit options', () => {
  const envNames = ['NOTIFICATION_EMAIL', 'SMTP_USER', 'APP_BASE_URL'];
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of envNames) {
      original[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of envNames) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  });

  it('falls back to empty environment-derived recipients', async () => {
    const mailer = new InMemoryMailer();
    const notifications = createNotifications(mailer);

    await notifications.sendRequest(request);

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe('');
    expect(mailer.sent[0].from).toBe('');
  });

  it('logs a non-Error send failure without throwing', async () => {
    const mailer = new InMemoryMailer();
    mailer.send = jest.fn().mockRejectedValueOnce('smtp exploded');
    const notifications = createNotifications(mailer, {
      to: 'admin@example.com',
      from: 'from@example.com',
      baseUrl: 'https://example.com',
    });

    await expect(notifications.sendTvSeries({
      title: 'Show',
      requestedBy: 'Alice',
      seasons: [1],
      totalSeasons: 1,
      posterPath: null,
      releaseDate: '2010-07-16',
    })).resolves.toBeUndefined();
  });
});

describe('renderer coverage edges', () => {
  it('parses a locale-style release date through Date', () => {
    const rendered = renderRequest({ ...request, release_date: '07/16/2010' }, 'https://example.com');

    expect(rendered.text).toContain('Year: 2010');
  });

  it('renders the season suffix in a one-request daily summary', () => {
    const rendered = renderDailySummary(
      [{ ...request, season_number: 2 }],
      'https://example.com',
    );

    expect(rendered.subject).toContain('Daily Summary: 1 active request');
    expect(rendered.text).toContain('"Inception" S2 (2010)');
    expect(rendered.html).toContain('S2');
  });
});
