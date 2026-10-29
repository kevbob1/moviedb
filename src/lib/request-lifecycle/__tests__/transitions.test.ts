import { makeInMemoryDrizzle } from '../../../test-support/fake-drizzle';
import { applyTransition, TransitionClient } from '../transitions';

const NOW = new Date('2026-06-15T12:00:00Z');
const fixedNow = () => NOW;

interface Row {
  [key: string]: unknown;
  id: number;
  title: string;
  tmdb_id: number | null;
  season_number: number | null;
  poster_path: string | null;
  overview: string | null;
  release_date: string | null;
  genre_ids: number[];
  requested_at: Date;
  requested_by: string;
  status: string;
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
  season_number: null,
  poster_path: null,
  overview: null,
  release_date: null,
  genre_ids: [],
  requested_at: new Date('2026-01-01T00:00:00Z'),
  requested_by: 'tester',
  status,
  media_type: 'movie',
  torrent_hash: null,
  torrent_problem: 'stale problem',
  resolved_at: null,
  suggestion_hash: 'old-hash',
  suggestion_score: 0.5,
  suggestion_computed_at: new Date('2026-01-02T00:00:00Z'),
});

/**
 * The smallest store the write path needs: the in-memory Drizzle fake, which
 * records the statements `applyTransition` runs so a test can assert both the
 * row it left behind and whether any write happened at all.
 */
function clientFor(row: Row | null) {
  const fake = makeInMemoryDrizzle({ requests: row ? [row] : [] });
  return {
    store: fake.store,
    client: fake.db as unknown as TransitionClient,
  };
}

/** The update statements recorded so far. */
const updates = (store: ReturnType<typeof clientFor>['store']) =>
  store.writes.filter((write) => write.op === 'update');

describe('request-lifecycle/transitions', () => {
  it('applies the resolved side effects and returns the projected request', async () => {
    const { store, client } = clientFor(makeRow('downloading'));

    const outcome = await applyTransition(client, 1, 'fulfilled', fixedNow);

    expect(outcome).toMatchObject({ ok: true });
    if (!outcome.ok) return;
    expect(outcome.request.id).toBe(1);
    expect(outcome.request.status).toBe('fulfilled');
    expect(outcome.request.torrent_problem).toBeUndefined();
    expect(store.requests[0].resolved_at).toBe(NOW);
    expect(store.requests[0].torrent_problem).toBeNull();
    expect(store.requests[0].suggestion_hash).toBeNull();
    expect(store.requests[0].suggestion_score).toBeNull();
    expect(store.requests[0].suggestion_computed_at).toBeNull();
  });

  it('writes extras alongside the side effects', async () => {
    const { store, client } = clientFor(makeRow('pending'));

    const outcome = await applyTransition(client, 1, 'downloading', fixedNow, { torrent_hash: 'h1' });

    expect(outcome.ok).toBe(true);
    expect(store.requests[0].torrent_hash).toBe('h1');
    expect(store.requests[0].status).toBe('downloading');
    expect(store.requests[0].resolved_at).toBeNull();
    expect(store.requests[0].suggestion_hash).toBeNull();
  });

  it('reports a missing request without writing', async () => {
    const { store, client } = clientFor(null);

    const outcome = await applyTransition(client, 999, 'fulfilled', fixedNow);

    expect(outcome).toEqual({ ok: false, skipped: 'not_found' });
    expect(updates(store)).toHaveLength(0);
    expect(store.requests).toHaveLength(0);
  });

  it('reports a disallowed transition with the status it is actually in', async () => {
    const { store, client } = clientFor(makeRow('fulfilled'));

    const outcome = await applyTransition(client, 1, 'downloading', fixedNow);

    expect(outcome).toEqual({ ok: false, skipped: 'invalid_transition', from: 'fulfilled' });
    expect(updates(store)).toHaveLength(0);
    expect(store.requests[0].status).toBe('fulfilled');
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
