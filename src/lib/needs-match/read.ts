import { logger } from '@/lib/logger';
import { latestRun, type JobRun } from '@/lib/jobs';
import { requestService, type Request, type RequestNeedsMatchPort } from '@/lib/request-lifecycle';
import { getAll, ping } from '@/lib/transmission';
import { Torrent } from '@/lib/transmission/adapter';

export interface NeedsMatchReadResult {
  requests: Request[];
  needsAttention: Request[];
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
  const [requests, needsAttention, torrentsResult, pingResult, lastSyncJob] = await Promise.all([
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

  return {
    requests: [
      ...requests,
      ...needsAttention.filter((attention) => !requests.some((request) => request.id === attention.id)),
    ],
    needsAttention,
    torrents: torrentsResult.torrents,
    transmissionError,
    transmissionState,
    torrentCount: torrentsResult.error ? null : torrentsResult.torrents.length,
    lastSync: lastSyncJob,
  };
}

export const readNeedsMatch = createNeedsMatchRead;
