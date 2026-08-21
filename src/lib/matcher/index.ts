import { parseTorrentTitle } from '@viren070/parse-torrent-title';

export interface MatchSuggestion {
  hash: string;
  score: number;
  eligible: boolean;
  reasons: string[];
}

export interface MatchRequest {
  id: string | number;
  title: string;
  media_type: string;
  release_date?: string | Date | null;
  season_number?: number | null;
}

export interface MatchTorrent {
  hash: string;
  name: string;
  files?: string[];
}

interface ParsedCandidate {
  hash: string;
  torrentIndex: number;
  parsed: ReturnType<typeof parseTorrentTitle>;
}

interface RankedCandidate {
  hash: string;
  torrentIndex: number;
  suggestion: MatchSuggestion;
  parsed: ReturnType<typeof parseTorrentTitle>;
}

const NOISE_TOKENS = new Set([
  // resolutions
  '1080p',
  '720p',
  '2160p',
  '4k',
  '1080i',
  '576p',
  '480p',
  // codecs
  'x264',
  'x265',
  'hevc',
  'xvid',
  'h264',
  'h265',
  'avc',
  '10bit',
  '8bit',
  // quality sources
  'bluray',
  'blu',
  'ray',
  'web',
  'dl',
  'webrip',
  'hdtv',
  'dvdrip',
  'bdrip',
  'brrip',
  'remux',
  // editions
  'extended',
  'remastered',
  'proper',
  'repack',
  'internal',
  'uncut',
  'uncensored',
  'unrated',
  'imax',
  'directors',
  'cut',
  'theatrical',
  'criterion',
  'deluxe',
  'edition',
  // hdr
  'hdr',
  'hdr10',
  'dolby',
  'vision',
  'dv',
]);

function dropReleaseGroup(title: string): string {
  const lastDash = title.lastIndexOf('-');
  if (lastDash === -1) return title;
  const afterDash = title.slice(lastDash + 1).trim();
  if (/^[A-Z0-9]+$/.test(afterDash)) {
    return title.slice(0, lastDash).trim();
  }
  return title;
}

function normalizeTitle(title: string): Set<string> {
  const withoutGroup = dropReleaseGroup(title);
  const tokens = withoutGroup
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];

  const filtered = tokens.filter((token) => {
    if (NOISE_TOKENS.has(token)) return false;
    if (/^\d{4}$/.test(token)) return false;
    return true;
  });

  return new Set(filtered);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function resolutionRank(resolution?: string): number {
  if (!resolution) return 0;
  const lower = resolution.toLowerCase();
  if (lower === '4k' || lower.includes('2160')) return 3;
  if (lower.includes('1080')) return 2;
  if (lower.includes('720')) return 1;
  return 0;
}

function qualityRank(quality?: string): number {
  if (!quality) return 0;
  const lower = quality.toLowerCase();
  if (lower.includes('bluray') || lower.includes('remux')) return 4;
  if (lower.includes('web-dl') || lower.includes('webdl') || lower.includes('webrip')) return 3;
  if (lower.includes('hdtv')) return 2;
  return 0;
}

function getRequestYear(releaseDate?: string | Date | null): number | undefined {
  if (releaseDate === undefined || releaseDate === null) return undefined;
  const date = typeof releaseDate === 'string' ? new Date(releaseDate) : releaseDate;
  const year = date.getFullYear();
  return Number.isNaN(year) ? undefined : year;
}

function evaluateCandidate(request: MatchRequest, candidate: ParsedCandidate): RankedCandidate {
  const parsed = candidate.parsed;

  if (!parsed.title) {
    return {
      hash: candidate.hash,
      torrentIndex: candidate.torrentIndex,
      parsed,
      suggestion: {
        hash: candidate.hash,
        score: 0,
        eligible: false,
        reasons: ['no parsed title'],
      },
    };
  }

  // Media-type filter.
  if (request.media_type === 'movie' && parsed.seasons !== undefined && parsed.seasons.length > 0) {
    return {
      hash: candidate.hash,
      torrentIndex: candidate.torrentIndex,
      parsed,
      suggestion: {
        hash: candidate.hash,
        score: 0,
        eligible: false,
        reasons: ['media_type mismatch: movie request vs season torrent'],
      },
    };
  }
  if (request.media_type === 'tv' && (parsed.seasons === undefined || parsed.seasons.length === 0)) {
    return {
      hash: candidate.hash,
      torrentIndex: candidate.torrentIndex,
      parsed,
      suggestion: {
        hash: candidate.hash,
        score: 0,
        eligible: false,
        reasons: ['media_type mismatch: tv request vs no-season torrent'],
      },
    };
  }

  // Year match when both sides have a year.
  const requestYear = getRequestYear(request.release_date);
  if (requestYear !== undefined && parsed.year !== undefined) {
    const parsedYear = parseInt(parsed.year, 10);
    if (!Number.isNaN(parsedYear) && parsedYear !== requestYear) {
      return {
        hash: candidate.hash,
        torrentIndex: candidate.torrentIndex,
        parsed,
        suggestion: {
          hash: candidate.hash,
          score: 0,
          eligible: false,
          reasons: [`year mismatch: ${requestYear} vs ${parsedYear}`],
        },
      };
    }
  }

  // Season signal when season_number is set.
  if (request.season_number !== undefined && request.season_number !== null) {
    if (parsed.complete !== true) {
      const seasonsText = parsed.seasons?.join(',') ?? '';
      return {
        hash: candidate.hash,
        torrentIndex: candidate.torrentIndex,
        parsed,
        suggestion: {
          hash: candidate.hash,
          score: 0,
          eligible: false,
          reasons: [`season not complete: seasons=[${seasonsText}] complete=${parsed.complete}`],
        },
      };
    }
    if (!parsed.seasons?.includes(request.season_number)) {
      const torrentSeasons = parsed.seasons?.join(',') ?? 'none';
      return {
        hash: candidate.hash,
        torrentIndex: candidate.torrentIndex,
        parsed,
        suggestion: {
          hash: candidate.hash,
          score: 0,
          eligible: false,
          reasons: [`season mismatch: request=${request.season_number} vs torrent=${torrentSeasons}`],
        },
      };
    }
  }

  const requestTokens = normalizeTitle(request.title);
  const candidateTokens = normalizeTitle(parsed.title);
  const score = jaccard(requestTokens, candidateTokens);

  return {
    hash: candidate.hash,
    torrentIndex: candidate.torrentIndex,
    parsed,
    suggestion: {
      hash: candidate.hash,
      score,
      eligible: true,
      reasons: [],
    },
  };
}

function isBetterRanked(a: RankedCandidate, b: RankedCandidate): boolean {
  if (a.suggestion.score !== b.suggestion.score) {
    return a.suggestion.score > b.suggestion.score;
  }
  const aRes = resolutionRank(a.parsed.resolution);
  const bRes = resolutionRank(b.parsed.resolution);
  if (aRes !== bRes) return aRes > bRes;
  const aQual = qualityRank(a.parsed.quality);
  const bQual = qualityRank(b.parsed.quality);
  if (aQual !== bQual) return aQual > bQual;
  return a.torrentIndex < b.torrentIndex;
}

export function matchSuggestions(
  requests: MatchRequest[],
  torrents: MatchTorrent[],
): Map<MatchRequest['id'], MatchSuggestion | null> {
  const result = new Map<MatchRequest['id'], MatchSuggestion | null>();

  for (const request of requests) {
    try {
      const candidates: ParsedCandidate[] = [];
      for (let i = 0; i < torrents.length; i++) {
        const torrent = torrents[i];
        const sources = [torrent.name, ...(torrent.files ?? [])];
        for (const source of sources) {
          if (!source) continue;
          const parsed = parseTorrentTitle(source);
          candidates.push({
            hash: torrent.hash,
            torrentIndex: i,
            parsed,
          });
        }
      }

      const evaluated = candidates.map((candidate) =>
        evaluateCandidate(request, candidate)
      );

      // Keep the best candidate per torrent hash.
      const bestByHash = new Map<string, RankedCandidate>();
      for (const ranked of evaluated) {
        const existing = bestByHash.get(ranked.hash);
        if (!existing || isBetterRanked(ranked, existing)) {
          bestByHash.set(ranked.hash, ranked);
        }
      }

      // Select the top eligible candidate across torrents.
      let top: RankedCandidate | undefined;
      for (const ranked of bestByHash.values()) {
        if (!ranked.suggestion.eligible) continue;
        if (!top || isBetterRanked(ranked, top)) {
          top = ranked;
        }
      }

      result.set(request.id, top?.suggestion ?? null);
    } catch {
      // A per-request error must not fail the whole batch.
      result.set(request.id, null);
    }
  }

  return result;
}
