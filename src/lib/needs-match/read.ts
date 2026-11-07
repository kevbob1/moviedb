import { logger } from '@/lib/logger';
import { latestRun, type JobRun } from '@/lib/jobs';
import { requestService, type Request, type RequestNeedsMatchPort } from '@/lib/request-lifecycle';
import { getAll, ping } from '@/lib/transmission';
import { Torrent } from '@/lib/transmission/adapter';

/** A suggestion with the torrent name resolved against the Transmission list. */
export interface MatchSuggestion {
  hash: string;
  name: string;
  score: number;
}

/** A pending Request together with its computed suggestion, if it has one. */
export type MatchRow = Request & { suggestion: MatchSuggestion | null };

/** A downloading Request whose torrent needs operator attention. */
export type AttentionRow = Request & {
  problem: string;
  linkedTorrentName: string | null;
};

export interface NeedsMatchReadResult {
  attention: AttentionRow[];
  pending: MatchRow[];
  torrents: Torrent[];
  transmissionError: string | null;
  transmissionState: 'not_configured' | 'unreachable' | 'ok';
  torrentCount: number | null;
  lastSync: JobRun | null;
}

export interface NeedsMatchReadDeps {
  /** Read port for the needs-match page; the default deps bind the singleton. */
  requestService: RequestNeedsMatchPort;
  getAll: typeof getAll;
  ping: typeof ping;
  latestSyncRun: () => Promise<JobRun | null>;
}

const defaultDeps: NeedsMatchReadDeps = {
  requestService,
  getAll,
  ping,
  latestSyncRun: () => latestRun('transmission_sync'),
};

export async function createNeedsMatchRead(
  deps: NeedsMatchReadDeps = defaultDeps,
): Promise<NeedsMatchReadResult> {
  const [requests, attentionRequests, torrentsResult, pingResult, lastSyncJob] = await Promise.all([
    deps.requestService.pendingRequestsForNeedsMatch(),
    deps.requestService.downloadingRequestsWithTorrentProblems(),
    deps.getAll()
      .then((torrents) => ({ torrents, error: null as string | null }))
      .catch((error: unknown) => ({
        torrents: [] as Torrent[],
        error: error instanceof Error ? error.message : 'Unknown error',
      })),
    deps.ping(),
    deps.latestSyncRun(),
  ]);

  if (torrentsResult.error) {
    logger.error({ error: torrentsResult.error }, 'Failed to fetch transmission torrents for needs-match');
  }

  const transmissionState =
    !pingResult.configured
      ? 'not_configured'
      : !pingResult.reachable || torrentsResult.error
        ? 'unreachable'
        : 'ok';

  const transmissionError = transmissionState === 'not_configured'
    ? null
    : (torrentsResult.error ?? pingResult.error ?? null);

  // Join the two request lists against the fetched torrents once, here, so
  // every client component receives names already embedded in its rows.
  const torrentNameByHash = new Map(
    torrentsResult.torrents.map((torrent) => [torrent.hash, torrent.name]),
  );

  const pending: MatchRow[] = requests.map((request) => ({
    ...request,
    suggestion: request.suggestion_hash
      ? {
          hash: request.suggestion_hash,
          name: torrentNameByHash.get(request.suggestion_hash) ?? request.suggestion_hash,
          score: request.suggestion_score ?? 0,
        }
      : null,
  }));

  const attention: AttentionRow[] = attentionRequests.map((request) => ({
    ...request,
    problem: request.torrent_problem ?? '',
    linkedTorrentName: request.torrent_hash
      ? (torrentNameByHash.get(request.torrent_hash) ?? request.torrent_hash)
      : null,
  }));

  return {
    attention,
    pending,
    torrents: torrentsResult.torrents,
    transmissionError,
    transmissionState,
    torrentCount: torrentsResult.error ? null : torrentsResult.torrents.length,
    lastSync: lastSyncJob,
  };
}

export const readNeedsMatch = createNeedsMatchRead;
