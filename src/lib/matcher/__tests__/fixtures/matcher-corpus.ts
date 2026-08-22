import type { MatchRequest, MatchTorrent } from '../../index';

export interface MatcherCorpusCase {
  name: string;
  provenance: string;
  torrent: MatchTorrent;
  parseSource?: string;
  request: MatchRequest;
  expectedParsed: {
    title: string;
    year?: string;
    seasons?: number[];
    complete?: boolean;
  };
  expectedHash: string | null;
}

const requestDefaults = { release_date: null, season_number: null };

export const matcherCorpus: MatcherCorpusCase[] = [
  {
    name: 'walking-dead-episode-release-noise',
    provenance: 'Public release-style example recorded in matcher fixture strategy (#66).',
    torrent: { hash: 'corpus-walking-dead', name: 'The.Walking.Dead.S05E03.720p.HDTV.x264-ASAP[ettv]' },
    request: { ...requestDefaults, id: 'walking-dead', title: 'The Walking Dead', media_type: 'tv', season_number: 5 },
    expectedParsed: { title: 'The Walking Dead', seasons: [5], complete: false },
    expectedHash: null,
  },
  {
    name: 'zero-dark-thirty-movie-metadata',
    provenance: 'Public release-style example recorded in matcher fixture strategy (#66).',
    torrent: { hash: 'corpus-zero-dark-thirty', name: 'Zero Dark Thirty (2012) [1080p BluRay HDR] [FR(VFF)-EN]' },
    request: { ...requestDefaults, id: 'zero-dark-thirty', title: 'Zero Dark Thirty', media_type: 'movie', release_date: '2012-12-19' },
    expectedParsed: { title: 'Zero Dark Thirty', year: '2012' },
    expectedHash: 'corpus-zero-dark-thirty',
  },
  {
    name: 'movie-punctuation-and-subtitle-noise',
    provenance: 'Representative release-style parser case selected by #66.',
    torrent: { hash: 'corpus-movie-title', name: 'Movie.Title.2020.1080p.HC.WEBRip.SUBS' },
    request: { ...requestDefaults, id: 'movie-title', title: 'Movie Title', media_type: 'movie', release_date: '2020-01-01' },
    expectedParsed: { title: 'Movie Title', year: '2020' },
    expectedHash: 'corpus-movie-title',
  },
  {
    name: 'season-name-folder-single-episode',
    provenance: 'Sonarr #7459 season-folder pattern; one file is not a complete pack.',
    torrent: { hash: 'corpus-season-folder', name: 'The.Walking.Dead.Season.1', files: ['The.Walking.Dead.S01E01.720p.HDTV.mkv'] },
    parseSource: 'The.Walking.Dead.S01E01.720p.HDTV.mkv',
    request: { ...requestDefaults, id: 'season-folder', title: 'The Walking Dead', media_type: 'tv', season_number: 1 },
    expectedParsed: { title: 'The Walking Dead', seasons: [1], complete: false },
    expectedHash: null,
  },
  {
    name: 'contained-filename-strong-title',
    provenance: 'Representative contained-filename acceptance case selected by #66.',
    torrent: { hash: 'corpus-contained-movie', name: 'download-archive', files: ['Zero.Dark.Thirty.2012.1080p.BluRay.mkv'] },
    parseSource: 'Zero.Dark.Thirty.2012.1080p.BluRay.mkv',
    request: { ...requestDefaults, id: 'contained-movie', title: 'Zero Dark Thirty', media_type: 'movie', release_date: '2012-12-19' },
    expectedParsed: { title: 'Zero Dark Thirty', year: '2012' },
    expectedHash: 'corpus-contained-movie',
  },
  {
    name: 'year-conflict',
    provenance: 'Representative contradictory year signal selected by #66.',
    torrent: { hash: 'corpus-dune-1984', name: 'Dune.1984.1080p.BluRay.x264-GROUP' },
    request: { ...requestDefaults, id: 'dune-2021', title: 'Dune', media_type: 'movie', release_date: '2021-10-22' },
    expectedParsed: { title: 'Dune', year: '1984' },
    expectedHash: null,
  },
  {
    name: 'unrelated-show',
    provenance: 'Representative title-identity rejection selected by #66.',
    torrent: { hash: 'corpus-unrelated-show', name: 'Some.Unrelated.Show.S02.COMPLETE.1080p.WEB-DL.x264-GROUP' },
    request: { ...requestDefaults, id: 'severance', title: 'Severance', media_type: 'tv', season_number: 1 },
    expectedParsed: { title: 'Some Unrelated Show', seasons: [2], complete: true },
    expectedHash: null,
  },
  {
    name: 'episode-only-season-request',
    provenance: 'Representative season-pack eligibility rejection selected by #66.',
    torrent: { hash: 'corpus-severance-episode', name: 'Severance.S01E03.720p.HDTV-GROUP' },
    request: { ...requestDefaults, id: 'severance-season', title: 'Severance', media_type: 'tv', season_number: 1 },
    expectedParsed: { title: 'Severance', seasons: [1], complete: false },
    expectedHash: null,
  },
  {
    name: 'explicit-season-pack',
    provenance: 'Representative Season 1 normalization case selected by #66.',
    torrent: { hash: 'corpus-severance-season', name: 'Severance.Season.1.COMPLETE.1080p.WEB-DL.x264-GROUP' },
    request: { ...requestDefaults, id: 'severance-complete', title: 'Severance', media_type: 'tv', season_number: 1 },
    expectedParsed: { title: 'Severance', seasons: [1], complete: true },
    expectedHash: 'corpus-severance-season',
  },
];
