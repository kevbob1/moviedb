import { createNeedsMatchRead } from '@/lib/needs-match/read';

const completedRun = {
  status: 'completed' as const,
  error: null,
  queuedAt: '2024-01-02T00:00:00.000Z',
  finishedAt: '2024-01-02T00:01:00.000Z',
  trigger: 'scheduled' as const,
  terminal: true,
};

describe('needs-match read', () => {
  test('splits attention from pending and embeds torrent names in each row', async () => {
    const pending = [
      {
        id: 1,
        title: 'Pending',
        status: 'pending',
        torrent_hash: null,
        suggestion_hash: 'abc',
        suggestion_score: 0.83,
      },
    ];
    const attention = [
      {
        id: 2,
        title: 'Attention',
        status: 'downloading',
        torrent_problem: 'missing',
        torrent_hash: 'abc',
      },
    ];
    const torrents = [{ hash: 'abc', name: 'torrent', percentDone: 0, status: 0 }];
    const read = createNeedsMatchRead({
      requestService: {
        pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue(pending),
        downloadingRequestsWithTorrentProblems: jest.fn().mockResolvedValue(attention),
      },
      getAll: jest.fn().mockResolvedValue(torrents),
      ping: jest.fn().mockResolvedValue({ configured: true, reachable: true }),
      latestSyncRun: jest.fn().mockResolvedValue(completedRun),
    });

    await expect(read).resolves.toEqual({
      attention: [{ ...attention[0], problem: 'missing', linkedTorrentName: 'torrent' }],
      pending: [
        { ...pending[0], suggestion: { hash: 'abc', name: 'torrent', score: 0.83 } },
      ],
      torrents,
      transmissionError: null,
      transmissionState: 'ok',
      torrentCount: 1,
      lastSync: completedRun,
    });
  });

  test('falls back to the hash when a suggestion or linked torrent is not in the fetched list', async () => {
    const pending = [
      { id: 1, title: 'Pending', status: 'pending', torrent_hash: null, suggestion_hash: 'deadbeef', suggestion_score: null },
    ];
    const attention = [
      { id: 2, title: 'Linked', status: 'downloading', torrent_problem: 'stalled', torrent_hash: 'cafebabe' },
      { id: 3, title: 'Unlinked', status: 'downloading', torrent_problem: 'errored', torrent_hash: null },
    ];
    const read = createNeedsMatchRead({
      requestService: {
        pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue(pending),
        downloadingRequestsWithTorrentProblems: jest.fn().mockResolvedValue(attention),
      },
      getAll: jest.fn().mockResolvedValue([]),
      ping: jest.fn().mockResolvedValue({ configured: true, reachable: true }),
      latestSyncRun: jest.fn().mockResolvedValue(null),
    });

    const result = await read;

    expect(result.pending).toEqual([
      {
        ...pending[0],
        suggestion: { hash: 'deadbeef', name: 'deadbeef', score: 0 },
      },
    ]);
    expect(result.attention).toEqual([
      { ...attention[0], problem: 'stalled', linkedTorrentName: 'cafebabe' },
      { ...attention[1], problem: 'errored', linkedTorrentName: null },
    ]);
  });

  test('keeps a request present in both lists without merging it away', async () => {
    const shared = { id: 7, title: 'Shared', status: 'pending' };
    const pending = [{ ...shared, torrent_hash: null, suggestion_hash: null }];
    const attention = [{ ...shared, status: 'downloading', torrent_problem: 'stalled', torrent_hash: null }];
    const read = createNeedsMatchRead({
      requestService: {
        pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue(pending),
        downloadingRequestsWithTorrentProblems: jest.fn().mockResolvedValue(attention),
      },
      getAll: jest.fn().mockResolvedValue([]),
      ping: jest.fn().mockResolvedValue({ configured: true, reachable: true }),
      latestSyncRun: jest.fn().mockResolvedValue(null),
    });

    const result = await read;

    expect(result.pending).toHaveLength(1);
    expect(result.attention).toHaveLength(1);
    expect(result.pending[0].id).toBe(7);
    expect(result.attention[0].id).toBe(7);
  });

  test('keeps request data and returns an error when Transmission torrents fail', async () => {
    const pending = [
      { id: 1, title: 'Pending', status: 'pending', torrent_hash: null, suggestion_hash: 'abc', suggestion_score: 0.4 },
    ];
    const error = new Error('Transmission unavailable');
    const read = createNeedsMatchRead({
      requestService: {
        pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue(pending),
        downloadingRequestsWithTorrentProblems: jest.fn().mockResolvedValue([]),
      },
      getAll: jest.fn().mockRejectedValue(error),
      ping: jest.fn().mockResolvedValue({ configured: true, reachable: false, error: 'Connection refused' }),
      latestSyncRun: jest.fn().mockResolvedValue(null),
    });

    await expect(read).resolves.toMatchObject({
      attention: [],
      pending: [
        { ...pending[0], suggestion: { hash: 'abc', name: 'abc', score: 0.4 } },
      ],
      torrents: [],
      transmissionError: 'Transmission unavailable',
      transmissionState: 'unreachable',
      torrentCount: null,
      lastSync: null,
    });
  });

  test('reports state not_configured and no error when Transmission ping is not configured', async () => {
    const pending = [{ id: 1, title: 'Pending', status: 'pending', torrent_hash: null }];
    const read = createNeedsMatchRead({
      requestService: {
        pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue(pending),
        downloadingRequestsWithTorrentProblems: jest.fn().mockResolvedValue([]),
      },
      getAll: jest.fn().mockResolvedValue([]),
      ping: jest.fn().mockResolvedValue({ configured: false, reachable: false }),
      latestSyncRun: jest.fn().mockResolvedValue(null),
    });

    await expect(read).resolves.toEqual({
      attention: [],
      pending: [{ ...pending[0], suggestion: null }],
      torrents: [],
      transmissionError: null,
      transmissionState: 'not_configured',
      torrentCount: 0,
      lastSync: null,
    });
  });
});
