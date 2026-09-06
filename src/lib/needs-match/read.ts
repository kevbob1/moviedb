import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requestService, Request, RequestService } from '@/lib/request-lifecycle';
import { getAll, ping } from '@/lib/transmission';
import { Torrent } from '@/lib/transmission/adapter';

export interface NeedsMatchLastSync {
  status: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface NeedsMatchReadResult {
  requests: Request[];
  needsAttention: Request[];
  torrents: Torrent[];
  transmissionError: string | null;
  transmissionState: 'not_configured' | 'unreachable' | 'ok';
  torrentCount: number | null;
  lastSync: NeedsMatchLastSync | null;
}

interface LatestTransmissionSync {
  status: string;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}

export interface NeedsMatchReadDeps {
  requestService: Pick<
    RequestService,
    'pendingRequestsForNeedsMatch' | 'downloadingRequestsWithTorrentProblems'
  >;
  getAll: typeof getAll;
  ping: typeof ping;
  findLatestTransmissionSync: () => Promise<LatestTransmissionSync | null>;
}

const defaultDeps: NeedsMatchReadDeps = {
  requestService,
  getAll,
  ping,
  findLatestTransmissionSync: () => prisma.job.findFirst({
    where: { type: 'transmission_sync' },
    orderBy: { created_at: 'desc' },
    select: { status: true, error: true, created_at: true, completed_at: true },
  }),
};

export function createNeedsMatchRead(deps: NeedsMatchReadDeps = defaultDeps): () => Promise<NeedsMatchReadResult> {
  return async function readNeedsMatch(): Promise<NeedsMatchReadResult> {
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
      deps.findLatestTransmissionSync(),
    ]);

    if (torrentsResult.error) {
      logger.error({ error: torrentsResult.error }, 'Failed to fetch transmission torrents for needs-match');
    }

    const transmissionState =
      pingResult.error === 'Transmission not configured'
        ? 'not_configured'
        : !pingResult.reachable || torrentsResult.error
          ? 'unreachable'
          : 'ok';

    return {
      requests: [
        ...requests,
        ...needsAttention.filter((attention) => !requests.some((request) => request.id === attention.id)),
      ],
      needsAttention,
      torrents: torrentsResult.torrents,
      transmissionError: torrentsResult.error ?? pingResult.error ?? null,
      transmissionState,
      torrentCount: torrentsResult.error ? null : torrentsResult.torrents.length,
      lastSync: lastSyncJob
        ? {
            status: lastSyncJob.status,
            error: lastSyncJob.error,
            createdAt: lastSyncJob.created_at.toISOString(),
            completedAt: lastSyncJob.completed_at?.toISOString() ?? null,
          }
        : null,
    };
  };
}

export const readNeedsMatch = createNeedsMatchRead();
