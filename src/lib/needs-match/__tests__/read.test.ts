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
  test('composes ordered requests, deduplicates attention rows, and projects the latest sync run', async () => {
    const pending = [{ id: 1, title: 'Pending', status: 'pending', torrent_hash: null }];
    const attention = [
      { id: 1, title: 'Pending', status: 'downloading', torrent_problem: 'stalled' },
      { id: 2, title: 'Attention', status: 'downloading', torrent_problem: 'missing' },
    ];
    const read = createNeedsMatchRead({
      requestService: {
        pendingRequestsForNeedsMatch: jest.fn().mockResolvedValue(pending),
        downloadingRequestsWithTorrentProblems: jest.fn().mockResolvedValue(attention),
      },
      getAll: jest.fn().mockResolvedValue([{ hash: 'abc', name: 'torrent', percentDone: 0, status: 0 }]),
      ping: jest.fn().mockResolvedValue({ configured: true, reachable: true }),
      latestSyncRun: jest.fn().mockResolvedValue(completedRun),
    });

    await expect(read).resolves.toEqual({
      requests: [pending[0], attention[1]],
      needsAttention: attention,
      torrents: [{ hash: 'abc', name: 'torrent', percentDone: 0, status: 0 }],
      transmissionError: null,
      transmissionState: 'ok',
      torrentCount: 1,
      lastSync: completedRun,
    });
  });

  test('keeps request data and returns an error when Transmission torrents fail', async () => {
    const pending = [{ id: 1, title: 'Pending', status: 'pending', torrent_hash: null }];
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
      requests: pending,
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
      requests: pending,
      needsAttention: [],
      torrents: [],
      transmissionError: null,
      transmissionState: 'not_configured',
      torrentCount: 0,
      lastSync: null,
    });
  });
});
