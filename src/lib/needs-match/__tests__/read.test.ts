import { createNeedsMatchRead } from '@/lib/needs-match/read';

describe('needs-match read', () => {
  test('composes ordered requests, deduplicates attention rows, and selects the latest sync job', async () => {
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
      ping: jest.fn().mockResolvedValue({ reachable: true }),
      findLatestTransmissionSync: jest.fn().mockResolvedValue({
        status: 'completed',
        error: null,
        created_at: new Date('2024-01-02T00:00:00Z'),
        completed_at: new Date('2024-01-02T00:01:00Z'),
      }),
    });

    await expect(read).resolves.toEqual({
      requests: [pending[0], attention[1]],
      needsAttention: attention,
      torrents: [{ hash: 'abc', name: 'torrent', percentDone: 0, status: 0 }],
      transmissionError: null,
      transmissionState: 'ok',
      torrentCount: 1,
      lastSync: {
        status: 'completed',
        error: null,
        createdAt: '2024-01-02T00:00:00.000Z',
        completedAt: '2024-01-02T00:01:00.000Z',
      },
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
      ping: jest.fn().mockResolvedValue({ reachable: false, error: 'Connection refused' }),
      findLatestTransmissionSync: jest.fn().mockResolvedValue(null),
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
});
