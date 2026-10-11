import { allocateMatches, MatchOutcome, MatchRequest, MatchTorrent } from '../index';
import { matcherCorpus } from './fixtures/matcher-corpus';
import { parseTorrentTitle } from '@viren070/parse-torrent-title';

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

/** The verdict one Request got, whatever kind it is. */
function outcomeFor(outcomes: MatchOutcome[], id: MatchRequest['id']): MatchOutcome | undefined {
  return outcomes.find((outcome) => outcome.requestId === id);
}

/**
 * The corpus predates allocation: it documents which torrent wins for one
 * Request, so read it back through whichever outcome carries a hash.
 */
function topHash(outcomes: MatchOutcome[], id: MatchRequest['id']): string | null {
  const outcome = outcomeFor(outcomes, id);
  return outcome && outcome.outcome !== 'none' ? outcome.hash : null;
}

describe('allocateMatches', () => {
  describe('checked-in matcher corpus', () => {
    for (const fixture of matcherCorpus) {
      it(`${fixture.name}: parses documented metadata and returns documented outcome`, () => {
        const parsed = parseTorrentTitle(fixture.parseSource ?? fixture.torrent.name);
        expect(parsed.title).toBe(fixture.expectedParsed.title);
        if (fixture.expectedParsed.year !== undefined) expect(parsed.year).toBe(fixture.expectedParsed.year);
        if (fixture.expectedParsed.seasons !== undefined) expect(parsed.seasons).toEqual(fixture.expectedParsed.seasons);
        if (fixture.expectedParsed.complete !== undefined) expect(parsed.complete ?? false).toBe(fixture.expectedParsed.complete);

        const { outcomes } = allocateMatches([fixture.request], [fixture.torrent]);
        expect(topHash(outcomes, fixture.request.id)).toBe(fixture.expectedHash);
      });
    }
  });

  describe('scoring and eligibility', () => {
    it('auto-links a confident movie match above the threshold', () => {
      const requests = [
        request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' }),
      ];
      const torrents = [
        torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' }),
      ];

      const { outcomes } = allocateMatches(requests, torrents);

      expect(outcomes).toEqual([
        { requestId: 'r1', outcome: 'auto-link', hash: 'h1', score: 1 },
      ]);
    });

    it('rejects a candidate when the year does not match', () => {
      const requests = [
        request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '1984-12-14' }),
      ];
      const torrents = [
        torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' }),
      ];

      const { outcomes } = allocateMatches(requests, torrents);

      expect(outcomes).toEqual([{ requestId: 'r1', outcome: 'none' }]);
    });

    it('matches a TV season pack', () => {
      const requests = [
        request({ id: 'r1', title: 'Severance', media_type: 'tv', season_number: 1 }),
      ];
      const torrents = [
        torrent({ hash: 'h1', name: 'Severance.S01.COMPLETE.1080p.WEB-DL.x264-GROUP' }),
      ];

      const { outcomes } = allocateMatches(requests, torrents);

      expect(outcomes).toEqual([
        { requestId: 'r1', outcome: 'auto-link', hash: 'h1', score: 1 },
      ]);
    });

    it('rejects a single-episode torrent for a season request', () => {
      const requests = [
        request({ id: 'r1', title: 'Severance', media_type: 'tv', season_number: 1 }),
      ];
      const torrents = [
        torrent({ hash: 'h1', name: 'Severance.S01E03.720p.HDTV-GROUP' }),
      ];

      const { outcomes } = allocateMatches(requests, torrents);

      expect(outcomes).toEqual([{ requestId: 'r1', outcome: 'none' }]);
    });

    it('returns none when no candidate is eligible', () => {
      const requests = [
        request({ id: 'r1', title: 'Severance', media_type: 'tv', season_number: 1 }),
      ];
      const torrents = [
        torrent({ hash: 'h1', name: 'Some.Unrelated.Show.S02.COMPLETE.1080p.WEB-DL.x264-GROUP' }),
      ];

      const { outcomes } = allocateMatches(requests, torrents);

      expect(outcomes).toEqual([{ requestId: 'r1', outcome: 'none' }]);
    });

    it('excludes a zero-score candidate from generated suggestions', () => {
      const { outcomes } = allocateMatches(
        [request({ id: 'r1', title: 'Dune', media_type: 'movie' })],
        [torrent({ hash: 'h1', name: 'Unrelated.2021.1080p.BluRay' })],
      );

      expect(outcomes).toEqual([{ requestId: 'r1', outcome: 'none' }]);
    });

    it('surfaces a candidate scoring exactly the minimum threshold as a suggestion', () => {
      const { outcomes } = allocateMatches(
        [request({ id: 'r1', title: 'Dune Movie', media_type: 'movie' })],
        [torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay' })],
      );

      expect(outcomes).toEqual([
        { requestId: 'r1', outcome: 'suggestion', hash: 'h1', score: 0.5 },
      ]);
    });

    it('rejects torrent names consisting only of hexadecimal characters', () => {
      const requests = [
        request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' }),
      ];
      const torrents = [torrent({ hash: 'h1', name: ' deadbeef0123 ' })];

      const { outcomes } = allocateMatches(requests, torrents);

      expect(outcomes).toEqual([{ requestId: 'r1', outcome: 'none' }]);
    });

    it('does not reject names that contain hexadecimal characters as part of a larger name', () => {
      const requests = [
        request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' }),
      ];
      const torrents = [torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264' })];

      const { outcomes } = allocateMatches(requests, torrents);

      expect(topHash(outcomes, 'r1')).toBe('h1');
    });

    it('tie-breaks by resolution and quality', () => {
      const requests = [
        request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' }),
      ];
      const torrents = [
        torrent({ hash: 'h720', name: 'Dune.2021.720p.HDTV.x264-GROUP' }),
        torrent({ hash: 'h1080', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' }),
      ];

      const { outcomes } = allocateMatches(requests, torrents);

      expect(outcomes).toEqual([
        { requestId: 'r1', outcome: 'auto-link', hash: 'h1080', score: 1 },
      ]);
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

      const { outcomes } = allocateMatches(requests, torrents);

      expect(outcomes).toEqual([
        { requestId: 'r1', outcome: 'auto-link', hash: 'h1', score: 1 },
      ]);
    });

    it('excludes a torrent claimed by an existing request', () => {
      const requests = [
        request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' }),
      ];
      const torrents = [
        torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' }),
      ];

      const { outcomes } = allocateMatches(requests, torrents, {
        claimedHashes: new Set(['h1']),
      });

      expect(outcomes).toEqual([{ requestId: 'r1', outcome: 'none' }]);
    });
  });

  describe('claim allocation (ADR-0009)', () => {
    const seasonPack = torrent({
      hash: 'pack',
      name: 'Severance.S01.COMPLETE.1080p.WEB-DL.x264-GROUP',
    });

    it('gives a contended torrent to the oldest request and nothing to the rest', () => {
      const requests = [
        request({ id: 'newer', title: 'Severance', media_type: 'tv', season_number: 1, requested_at: '2026-02-01T00:00:00Z' }),
        request({ id: 'older', title: 'Severance', media_type: 'tv', season_number: 1, requested_at: '2026-01-01T00:00:00Z' }),
      ];

      const { outcomes } = allocateMatches(requests, [seasonPack]);

      // Outcomes are in allocation order, so the winner is first by construction.
      expect(outcomes[0]).toEqual({ requestId: 'older', outcome: 'auto-link', hash: 'pack', score: 1 });
      expect(outcomeFor(outcomes, 'newer')).toEqual({ requestId: 'newer', outcome: 'none' });
    });

    it('breaks a tie on identical timestamps by the lower id', () => {
      const requests = [
        request({ id: 'second', title: 'Severance', media_type: 'tv', season_number: 1 }),
        request({ id: 'first', title: 'Severance', media_type: 'tv', season_number: 1 }),
      ];

      const { outcomes } = allocateMatches(requests, [seasonPack]);

      expect(outcomes[0].requestId).toBe('first');
      expect(outcomeFor(outcomes, 'second')).toEqual({ requestId: 'second', outcome: 'none' });
    });

    it('allocates to the lowest season when a multi-season pack is contended', () => {
      const multiSeasonPack = torrent({
        hash: 'multi',
        name: 'Severance.S01.S02.COMPLETE.1080p.WEB-DL.x264-GROUP',
      });
      const requests = [
        request({ id: 'season-2', title: 'Severance', media_type: 'tv', season_number: 2 }),
        request({ id: 'season-1', title: 'Severance', media_type: 'tv', season_number: 1 }),
      ];

      const { outcomes } = allocateMatches(requests, [multiSeasonPack]);

      expect(outcomes[0]).toEqual({ requestId: 'season-1', outcome: 'auto-link', hash: 'multi', score: 1 });
      expect(outcomeFor(outcomes, 'season-2')).toEqual({ requestId: 'season-2', outcome: 'none' });
    });

    it('offers the same torrent to both requests when neither clears the auto-link score', () => {
      // A persisted suggestion does not spend a claim, so both may be offered
      // it until an operator accepts — the behaviour ADR-0009 records.
      const requests = [
        request({ id: 'a', title: 'Dune Part Two', media_type: 'movie' }),
        request({ id: 'b', title: 'Dune Part Two', media_type: 'movie' }),
      ];
      const torrents = [torrent({ hash: 'partial', name: 'Dune.Two.2024.1080p.BluRay' })];

      const { outcomes } = allocateMatches(requests, torrents);

      expect(outcomeFor(outcomes, 'a')).toEqual({ requestId: 'a', outcome: 'suggestion', hash: 'partial', score: 2 / 3 });
      expect(outcomeFor(outcomes, 'b')).toEqual({ requestId: 'b', outcome: 'suggestion', hash: 'partial', score: 2 / 3 });
    });

    it('reports one outcome per request, including requests that got nothing', () => {
      const requests = [
        request({ id: 'matched', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' }),
        request({ id: 'unmatched', title: 'Nothing Like It', media_type: 'movie' }),
      ];
      const torrents = [torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' })];

      const { outcomes } = allocateMatches(requests, torrents);

      expect(outcomes).toHaveLength(2);
      expect(outcomeFor(outcomes, 'matched')?.outcome).toBe('auto-link');
      expect(outcomeFor(outcomes, 'unmatched')).toEqual({ requestId: 'unmatched', outcome: 'none' });
    });
  });

  describe('parser failures', () => {
    it('counts an unreadable release name once, not once per request', () => {
      const requests = [
        request({ id: 'a', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' }),
        request({ id: 'b', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' }),
      ];
      const torrents = [
        torrent({ hash: 'unreadable', name: '1080p' }),
        torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' }),
      ];

      const { parserFailures } = allocateMatches(requests, torrents);

      expect(parserFailures).toBe(1);
    });

    it('counts each unreadable source in the catalogue', () => {
      const { parserFailures } = allocateMatches(
        [request({ id: 'r1', title: 'Dune', media_type: 'movie' })],
        [
          torrent({ hash: 'a', name: '1080p', files: ['2160p'] }),
          torrent({ hash: 'b', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' }),
        ],
      );

      expect(parserFailures).toBe(2);
    });

    it('counts nothing when every release name parses', () => {
      const { parserFailures } = allocateMatches(
        [request({ id: 'r1', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' })],
        [torrent({ hash: 'h1', name: 'Dune.2021.1080p.BluRay.x264-SWEETNESS' })],
      );

      expect(parserFailures).toBe(0);
    });
  });
});
