import { applyTransition, TransitionClient } from '../transitions';

const NOW = new Date('2026-06-15T12:00:00Z');
const fixedNow = () => NOW;

interface Row {
  id: number;
  title: string;
  tmdb_id: number | null;
  poster_path: string | null;
  overview: string | null;
  release_date: string | null;
  genre_ids: number[];
  requested_at: Date;
  requested_by: string;
  status: string;
  season_number: number | null;
  media_type: string | null;
  torrent_hash: string | null;
  torrent_problem: string | null;
  resolved_at: Date | null;
  suggestion_hash: string | null;
  suggestion_score: number | null;
  suggestion_computed_at: Date | null;
}

const makeRow = (status: string): Row => ({
  id: 1,
  title: 'Dune',
  tmdb_id: 1,
  poster_path: null,
  overview: null,
  release_date: null,
  genre_ids: [],
  requested_at: new Date('2026-01-01T00:00:00Z'),
  requested_by: 'tester',
  status,
  season_number: null,
  media_type: 'movie',
  torrent_hash: null,
  torrent_problem: 'stale problem',
  resolved_at: null,
  suggestion_hash: 'old-hash',
  suggestion_score: 0.5,
  suggestion_computed_at: new Date('2026-01-02T00:00:00Z'),
});

/**
 * The smallest client that satisfies the write path: one row it can read and
 * write. Tests drive `applyTransition` behaviour directly, so nothing here
 * re-implements the rest of the Prisma surface.
 */
function clientFor(row: Row | null) {
  const state = { row };
  const updates: Array<Record<string, unknown>> = [];

  const client = {
    request: {
      findUnique: jest.fn(async ({ where }: { where: { id: number } }) =>
        state.row && state.row.id === where.id ? state.row : null,
      ),
      update: jest.fn(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        if (!state.row || state.row.id !== where.id) throw new Error('Not found');
        Object.assign(state.row, data);
        updates.push(data);
        return state.row;
      }),
    },
  };

  return {
    state,
    updates,
    client: client as unknown as TransitionClient,
  };
}

describe('request-lifecycle/transitions', () => {
  it('applies the resolved side effects and returns the projected request', async () => {
    const { state, client } = clientFor(makeRow('downloading'));

    const outcome = await applyTransition(client, 1, 'fulfilled', fixedNow);

    expect(outcome).toMatchObject({ ok: true });
    if (!outcome.ok) return;
    expect(outcome.request.id).toBe(1);
    expect(outcome.request.status).toBe('fulfilled');
    expect(outcome.request.torrent_problem).toBeUndefined();
    expect(state.row?.resolved_at).toBe(NOW);
    expect(state.row?.torrent_problem).toBeNull();
    expect(state.row?.suggestion_hash).toBeNull();
    expect(state.row?.suggestion_score).toBeNull();
    expect(state.row?.suggestion_computed_at).toBeNull();
  });

  it('writes extras alongside the side effects', async () => {
    const { state, client } = clientFor(makeRow('pending'));

    const outcome = await applyTransition(client, 1, 'downloading', fixedNow, { torrent_hash: 'h1' });

    expect(outcome.ok).toBe(true);
    expect(state.row?.torrent_hash).toBe('h1');
    expect(state.row?.status).toBe('downloading');
    expect(state.row?.resolved_at).toBeNull();
    expect(state.row?.suggestion_hash).toBeNull();
  });

  it('reports a missing request without writing', async () => {
    const { state, updates, client } = clientFor(null);

    const outcome = await applyTransition(client, 999, 'fulfilled', fixedNow);

    expect(outcome).toEqual({ ok: false, skipped: 'not_found' });
    expect(updates).toHaveLength(0);
    expect(state.row).toBeNull();
  });

  it('reports a disallowed transition with the status it is actually in', async () => {
    const { state, updates, client } = clientFor(makeRow('fulfilled'));

    const outcome = await applyTransition(client, 1, 'downloading', fixedNow);

    expect(outcome).toEqual({ ok: false, skipped: 'invalid_transition', from: 'fulfilled' });
    expect(updates).toHaveLength(0);
    expect(state.row?.status).toBe('fulfilled');
  });

  it('serves whichever client it is handed, because one write path runs either', async () => {
    const tx = clientFor(makeRow('pending'));
    const root = clientFor(makeRow('pending'));

    const fromTx = await applyTransition(tx.client, 1, 'downloading', fixedNow);
    const fromRoot = await applyTransition(root.client, 1, 'downloading', fixedNow);

    expect(fromTx).toMatchObject({ ok: true });
    expect(fromRoot).toMatchObject({ ok: true });
  });
});
