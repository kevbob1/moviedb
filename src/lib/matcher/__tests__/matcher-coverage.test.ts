jest.mock('@viren070/parse-torrent-title', () => {
  const actual = jest.requireActual<typeof import('@viren070/parse-torrent-title')>(
    '@viren070/parse-torrent-title',
  );
  return {
    ...actual,
    parseTorrentTitle: (name: string) => {
      if (name === 'PARSE_THROW') throw new Error('unparseable');
      return actual.parseTorrentTitle(name);
    },
  };
});

import { allocateMatches, MatchRequest, MatchTorrent } from '../index';

function request(
  overrides: Partial<MatchRequest> & Pick<MatchRequest, 'id' | 'title' | 'media_type'>,
): MatchRequest {
  return {
    release_date: null,
    season_number: null,
    requested_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function torrent(
  overrides: Partial<MatchTorrent> & Pick<MatchTorrent, 'hash' | 'name'>,
): MatchTorrent {
  return {
    files: [],
    ...overrides,
  };
}

describe('matcher coverage edges', () => {
  it('drops an uppercase release-group suffix from the request title', () => {
    const { outcomes } = allocateMatches(
      [request({ id: 'r1', title: 'Dune-GROUP', media_type: 'movie', release_date: '2021-10-22' })],
      [torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' })],
    );

    expect(outcomes).toEqual([
      { requestId: 'r1', outcome: 'auto-link', hash: 'h1', score: 1 },
    ]);
  });

  it('rejects a movie torrent for a TV request that has no seasons', () => {
    const { outcomes } = allocateMatches(
      [request({ id: 'r1', title: 'Dune', media_type: 'tv', season_number: 1 })],
      [torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' })],
    );

    expect(outcomes).toEqual([{ requestId: 'r1', outcome: 'none' }]);
  });

  it('treats a title with no alphanumeric tokens as scoring zero', () => {
    const { outcomes } = allocateMatches(
      [request({ id: 'r1', title: '---', media_type: 'movie' })],
      [torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' })],
    );

    expect(outcomes).toEqual([{ requestId: 'r1', outcome: 'none' }]);
  });

  it('ranks an unrecognised resolution below 720p and breaks the tie on quality', () => {
    const { outcomes } = allocateMatches(
      [request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' })],
      [
        torrent({ hash: 'h-web', name: 'Dune.2021.480p.WEB-DL.x264-AAA' }),
        torrent({ hash: 'h-hdtv', name: 'Dune.2021.480p.HDTV.x264-BBB' }),
      ],
    );

    expect(outcomes).toEqual([
      { requestId: 'r1', outcome: 'auto-link', hash: 'h-web', score: 1 },
    ]);
  });

  it('falls back to zero quality when the parser reports no quality', () => {
    const { outcomes } = allocateMatches(
      [request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' })],
      [
        torrent({ hash: 'h-plain', name: 'Dune.2021.480p.x264-AAA' }),
        torrent({ hash: 'h-hdtv', name: 'Dune.2021.480p.HDTV.x264-BBB' }),
      ],
    );

    expect(outcomes).toEqual([
      { requestId: 'r1', outcome: 'auto-link', hash: 'h-hdtv', score: 1 },
    ]);
  });

  it('breaks a fully equal tie by torrent index', () => {
    const { outcomes } = allocateMatches(
      [request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' })],
      [
        torrent({ hash: 'h-first', name: 'Dune.2021.1080p.BluRay.x264-AAA' }),
        torrent({ hash: 'h-second', name: 'Dune.2021.1080p.BluRay.x264-BBB' }),
      ],
    );

    expect(outcomes).toEqual([
      { requestId: 'r1', outcome: 'auto-link', hash: 'h-first', score: 1 },
    ]);
  });

  it('counts a release name whose parser throws as a parser failure', () => {
    const { parserFailures, outcomes } = allocateMatches(
      [request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' })],
      [
        torrent({ hash: 'broken', name: 'PARSE_THROW' }),
        torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' }),
      ],
    );

    expect(parserFailures).toBe(1);
    expect(outcomes).toEqual([
      { requestId: 'r1', outcome: 'auto-link', hash: 'h1', score: 1 },
    ]);
  });

  it('keeps the batch alive when scoring one request throws', () => {
    const exploding = request({ id: 'boom', title: 'Dune', media_type: 'movie' });
    Object.defineProperty(exploding, 'title', {
      get() {
        throw new Error('title exploded');
      },
    });

    const { outcomes } = allocateMatches(
      [exploding, request({ id: 'ok', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' })],
      [torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' })],
    );

    expect(outcomes).toContainEqual({ requestId: 'boom', outcome: 'none' });
    expect(outcomes).toContainEqual({ requestId: 'ok', outcome: 'auto-link', hash: 'h1', score: 1 });
  });
});
