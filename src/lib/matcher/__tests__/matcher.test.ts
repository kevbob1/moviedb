import { matchSuggestions, MatchRequest, MatchTorrent } from '../index';
import { matcherCorpus } from './fixtures/matcher-corpus';
import { parseTorrentTitle } from '@viren070/parse-torrent-title';

function request(overrides: Partial<MatchRequest> & Pick<MatchRequest, 'id' | 'title' | 'media_type'>): MatchRequest {
  return {
    release_date: null,
    season_number: null,
    ...overrides,
  };
}

function torrent(overrides: Partial<MatchTorrent> & Pick<MatchTorrent, 'hash' | 'name'>): MatchTorrent {
  return {
    files: [],
    ...overrides,
  };
}

describe('matchSuggestions', () => {
  describe('checked-in matcher corpus', () => {
    for (const fixture of matcherCorpus) {
      it(`${fixture.name}: parses documented metadata and returns documented outcome`, () => {
        const parsed = parseTorrentTitle(fixture.parseSource ?? fixture.torrent.name);
        expect(parsed.title).toBe(fixture.expectedParsed.title);
        if (fixture.expectedParsed.year !== undefined) expect(parsed.year).toBe(fixture.expectedParsed.year);
        if (fixture.expectedParsed.seasons !== undefined) expect(parsed.seasons).toEqual(fixture.expectedParsed.seasons);
        if (fixture.expectedParsed.complete !== undefined) expect(parsed.complete ?? false).toBe(fixture.expectedParsed.complete);

        const result = matchSuggestions([fixture.request], [fixture.torrent]);
        expect(result.get(fixture.request.id)?.hash ?? null).toBe(fixture.expectedHash);
      });
    }
  });

  it('returns a confident movie match', () => {
    const requests = [
      request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' }),
    ];
    const torrents = [
      torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' }),
    ];

    const result = matchSuggestions(requests, torrents);

    expect(result.get('r1')).toEqual({
      hash: 'h1',
      score: 1,
      eligible: true,
      reasons: [],
    });
  });

  it('rejects a candidate when the year does not match', () => {
    const requests = [
      request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '1984-12-14' }),
    ];
    const torrents = [
      torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' }),
    ];

    const result = matchSuggestions(requests, torrents);

    expect(result.get('r1')).toBeNull();
  });

  it('matches a TV season pack', () => {
    const requests = [
      request({ id: 'r1', title: 'Severance', media_type: 'tv', season_number: 1 }),
    ];
    const torrents = [
      torrent({ hash: 'h1', name: 'Severance.S01.COMPLETE.1080p.WEB-DL.x264-GROUP' }),
    ];

    const result = matchSuggestions(requests, torrents);

    expect(result.get('r1')).toEqual({
      hash: 'h1',
      score: 1,
      eligible: true,
      reasons: [],
    });
  });

  it('rejects a single-episode torrent for a season request', () => {
    const requests = [
      request({ id: 'r1', title: 'Severance', media_type: 'tv', season_number: 1 }),
    ];
    const torrents = [
      torrent({ hash: 'h1', name: 'Severance.S01E03.720p.HDTV-GROUP' }),
    ];

    const result = matchSuggestions(requests, torrents);

    expect(result.get('r1')).toBeNull();
  });

  it('returns null when no candidate is eligible', () => {
    const requests = [
      request({ id: 'r1', title: 'Severance', media_type: 'tv', season_number: 1 }),
    ];
    const torrents = [
      torrent({ hash: 'h1', name: 'Some.Unrelated.Show.S02.COMPLETE.1080p.WEB-DL.x264-GROUP' }),
    ];

    const result = matchSuggestions(requests, torrents);

    expect(result.get('r1')).toBeNull();
  });

  it('tie-breaks by resolution and quality', () => {
    const requests = [
      request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' }),
    ];
    const torrents = [
      torrent({ hash: 'h720', name: 'Dune.2021.720p.HDTV.x264-GROUP' }),
      torrent({ hash: 'h1080', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' }),
    ];

    const result = matchSuggestions(requests, torrents);

    expect(result.get('r1')).toEqual({
      hash: 'h1080',
      score: 1,
      eligible: true,
      reasons: [],
    });
  });

  it('considers contained filenames as candidates', () => {
    const requests = [
      request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' }),
    ];
    const torrents = [
      torrent({
        hash: 'h1',
        name: 'folder-with-generic-name',
        files: ['Dune.2021.1080p.BluRay.x264-SWEETNESS.mkv'],
      }),
    ];

    const result = matchSuggestions(requests, torrents);

    expect(result.get('r1')).toEqual({
      hash: 'h1',
      score: 1,
      eligible: true,
      reasons: [],
    });
  });
});
