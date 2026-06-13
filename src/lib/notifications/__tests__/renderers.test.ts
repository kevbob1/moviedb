import { renderRequest, renderTvSeries, renderDailySummary, NotificationRequest, TvSeriesNotificationPayload } from '../renderers';

const baseUrl = 'https://example.com';

describe('renderRequest', () => {
  const baseRequest: NotificationRequest = {
    id: 1,
    title: 'Inception',
    requested_by: 'Alice',
    status: 'pending',
    requested_at: new Date('2026-06-06T10:00:00Z'),
    release_date: '2010-07-16',
    media_type: 'movie',
    season_number: null,
  };

  it('produces subject, text, and html', () => {
    const r = renderRequest(baseRequest, baseUrl);
    expect(r.subject).toContain('Inception');
    expect(r.text).toContain('Alice');
    expect(r.html).toContain('Inception');
  });

  it('escapes html in title, requester, and status', () => {
    const r = renderRequest({ ...baseRequest, title: '<x>', requested_by: 'A & B', status: 'foo' }, baseUrl);
    expect(r.html).toContain('&lt;x&gt;');
    expect(r.html).toContain('A &amp; B');
    expect(r.text).toContain('<x>');
  });

  it.each([
    ['2010-07-16', '2010'],
    [null, 'Unknown'],
    [undefined, 'Unknown'],
    ['not-a-date', 'Unknown'],
  ])('handles release_date %p → year %p', (release_date, expectedYear) => {
    const r = renderRequest({ ...baseRequest, release_date: release_date as string | null }, baseUrl);
    expect(r.text).toContain(`Year: ${expectedYear}`);
  });

  it('uses TV label and season suffix for tv media_type', () => {
    const r = renderRequest({ ...baseRequest, media_type: 'tv', season_number: 2 }, baseUrl);
    expect(r.subject).toContain('Season 2');
    expect(r.html).toContain('TV Show');
  });
});

describe('renderTvSeries', () => {
  const basePayload: TvSeriesNotificationPayload = {
    title: 'Best Show',
    requestedBy: 'Alice',
    seasons: [1, 2, 3],
    totalSeasons: 3,
    posterPath: null,
    releaseDate: '2023-01-01',
  };

  it('produces a single-season subject when only one season', () => {
    const r = renderTvSeries({ ...basePayload, seasons: [2] }, baseUrl);
    expect(r.subject).toContain('Season 2');
  });

  it('produces a season range subject for multiple seasons', () => {
    const r = renderTvSeries(basePayload, baseUrl);
    expect(r.subject).toContain('Seasons 1-3');
  });

  it('escapes html in payload fields', () => {
    const r = renderTvSeries({ ...basePayload, title: '<bad>', requestedBy: 'A & B' }, baseUrl);
    expect(r.html).toContain('&lt;bad&gt;');
    expect(r.html).toContain('A &amp; B');
  });
});

describe('renderDailySummary', () => {
  const reqs: NotificationRequest[] = [
    { id: 1, title: 'Inception', requested_by: 'Alice', status: 'pending', requested_at: new Date(), release_date: '2010-07-16' },
    { id: 2, title: 'Matrix', requested_by: 'Bob', status: 'downloading', requested_at: new Date(), release_date: '1999-03-31' },
  ];

  it('produces plural subject for multiple requests', () => {
    const r = renderDailySummary(reqs, baseUrl);
    expect(r.subject).toContain('2 active requests');
  });

  it('produces singular subject for one request', () => {
    const r = renderDailySummary([reqs[0]], baseUrl);
    expect(r.subject).toContain('1 active request');
  });

  it('handles empty array with No active requests message', () => {
    const r = renderDailySummary([], baseUrl);
    expect(r.text).toContain('No active requests at this time.');
    expect(r.html).toContain('No active requests at this time.');
  });

  it('escapes html in each request', () => {
    const r = renderDailySummary([{ ...reqs[0], title: '<x>', requested_by: 'A & B', status: 'a<b' }], baseUrl);
    expect(r.html).toContain('&lt;x&gt;');
    expect(r.html).toContain('A &amp; B');
    expect(r.html).toContain('a&lt;b');
  });
});
