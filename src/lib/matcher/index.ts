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
  /** ADR-0009: the tie-break by which Requests contend for one torrent. */
  requested_at: string | Date;
}

export interface MatchTorrent {
  hash: string;
  name: string;
  files?: string[];
}

interface ParsedCandidate {
  hash: string;
  torrentIndex: number;
  sourceName: string;
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

const MINIMUM_SUGGESTION_SCORE = 0.5;

/**
 * ADR-0009: a generated suggestion at or above this score links itself. The
 * band below it (and at or above `MINIMUM_SUGGESTION_SCORE`) stays an
 * operator-confirmed suggestion.
 */
export const AUTO_LINK_SCORE = 0.9;

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

  if (/^[0-9a-f]+$/i.test(candidate.sourceName.trim())) {
    return {
      hash: candidate.hash,
      torrentIndex: candidate.torrentIndex,
      parsed,
      suggestion: {
        hash: candidate.hash,
        score: -Infinity,
        eligible: false,
        reasons: ['torrent name is hexadecimal only'],
      },
    };
  }

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

export interface MatchOptions {
  /**
   * Torrent hashes already claimed by an existing Request (any status). ADR-0009
   * excludes them from every Request's candidates; manual `linkTorrent` is not
   * filtered by this option.
   */
  claimedHashes?: ReadonlySet<string>;
}

/**
 * What one pass decided for one Request, after scores, thresholds and
 * contention have all been resolved. Above `AUTO_LINK_SCORE` the match links
 * itself; in the band above the suggestion floor it waits for the operator;
 * otherwise there is nothing to surface. A plain `none` is deliberate —
 * ADR-0009 already says a Request that loses contention simply gets no
 * suggestion that pass.
 */
export type MatchOutcome =
  | { requestId: MatchRequest['id']; outcome: 'auto-link'; hash: string; score: number }
  | { requestId: MatchRequest['id']; outcome: 'suggestion'; hash: string; score: number }
  | { requestId: MatchRequest['id']; outcome: 'none' };

/**
 * The result of one allocation pass: one outcome per Request, in the order the
 * allocation considered them, plus how many release names the parser could not
 * read — the metric only this module can observe.
 */
export interface MatchAllocation {
  outcomes: MatchOutcome[];
  parserFailures: number;
}

function requestedAtTime(requestedAt: string | Date): number {
  const date = typeof requestedAt === 'string' ? new Date(requestedAt) : requestedAt;
  const time = date.getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function compareIds(a: MatchRequest['id'], b: MatchRequest['id']): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/**
 * ADR-0009 allocation order for Requests contended for by one torrent: lowest
 * season, then oldest Request, then lowest id. A missing season sorts last,
 * matching Postgres `ASC` null ordering.
 */
function byClaimOrder(a: MatchRequest, b: MatchRequest): number {
  const seasonA = a.season_number ?? Number.POSITIVE_INFINITY;
  const seasonB = b.season_number ?? Number.POSITIVE_INFINITY;
  if (seasonA !== seasonB) return seasonA - seasonB;

  const requestedA = requestedAtTime(a.requested_at);
  const requestedB = requestedAtTime(b.requested_at);
  if (requestedA !== requestedB) return requestedA < requestedB ? -1 : 1;

  return compareIds(a.id, b.id);
}

/**
 * ADR-0008 + ADR-0009 in one pass. Scores every Request against the torrent
 * catalogue, then allocates: one torrent serves one Request, so the Requests
 * are walked in claim order and the first one whose top candidate clears
 * `AUTO_LINK_SCORE` takes the torrent for the rest of the pass.
 *
 * A persisted suggestion does not spend a claim; only an auto-link does. So two
 * Requests scoring below the auto-link threshold may still be offered the same
 * torrent, which is the behaviour ADR-0009 records.
 */
export function allocateMatches(
  requests: MatchRequest[],
  torrents: MatchTorrent[],
  options: MatchOptions = {},
): MatchAllocation {
  const claimed = new Set<string>(options.claimedHashes ?? []);

  // Parse every release name once for the whole catalogue. This is the only
  // parse in the system: reporting cannot afford to redo it, and the parse is
  // the expensive part a pass performs per torrent rather than per Request.
  const candidates: ParsedCandidate[] = [];
  let parserFailures = 0;
  for (let i = 0; i < torrents.length; i++) {
    const torrent = torrents[i];
    for (const source of [torrent.name, ...(torrent.files ?? [])]) {
      if (!source) continue;
      let parsed: ReturnType<typeof parseTorrentTitle>;
      try {
        parsed = parseTorrentTitle(source);
      } catch {
        parserFailures++;
        continue;
      }
      if (!parsed.title) {
        parserFailures++;
        continue;
      }
      candidates.push({
        hash: torrent.hash,
        torrentIndex: i,
        sourceName: source,
        parsed,
      });
    }
  }

  const outcomes: MatchOutcome[] = [];

  for (const request of [...requests].sort(byClaimOrder)) {
    let outcome: MatchOutcome = { requestId: request.id, outcome: 'none' };
    try {
      // A claimed torrent is nobody's candidate, whether it was claimed before
      // the pass or by an auto-link earlier in this one.
      const eligible = candidates.filter((candidate) => !claimed.has(candidate.hash));
      const evaluated = eligible.map((candidate) => evaluateCandidate(request, candidate));

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
        if (!ranked.suggestion.eligible || ranked.suggestion.score < MINIMUM_SUGGESTION_SCORE) continue;
        if (!top || isBetterRanked(ranked, top)) {
          top = ranked;
        }
      }

      if (top) {
        outcome = top.suggestion.score >= AUTO_LINK_SCORE
          ? { requestId: request.id, outcome: 'auto-link', hash: top.hash, score: top.suggestion.score }
          : { requestId: request.id, outcome: 'suggestion', hash: top.hash, score: top.suggestion.score };
        if (outcome.outcome === 'auto-link') claimed.add(top.hash);
      }
    } catch {
      // A per-Request error must not fail the whole batch.
    }

    outcomes.push(outcome);
  }

  return { outcomes, parserFailures };
}
