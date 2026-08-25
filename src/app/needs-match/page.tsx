import { prisma } from '@/lib/prisma';
import { getAll, refreshCatalog, ping } from '@/lib/transmission';
import { Torrent } from '@/lib/transmission/adapter';
import { logger } from '@/lib/logger';
import { toRequestModel } from '@/lib/request-lifecycle';
import { NeedsMatchView } from '@/components/NeedsMatchView';
import { TransmissionStatusBanner } from '@/components/TransmissionStatusBanner';
import { RefreshButton } from '@/components/RefreshButton';
import Link from 'next/link';
import { runTransmissionSync } from '@/lib/jobs/transmission-sync';
import { HttpTransmissionAdapter } from '@/lib/transmission/adapter';

export default async function NeedsMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ refresh?: string }>;
}) {
  const params = await searchParams;

  if (params.refresh === '1') {
    refreshCatalog();
    await runTransmissionSync(new HttpTransmissionAdapter(), { ignoreSuggestionAgeGate: true });
  }

  const [requests, torrentsResult, pingResult, needsAttention, lastSyncJob] = await Promise.all([
    prisma.request.findMany({
      where: {
        status: 'pending',
        torrent_hash: null,
      },
      orderBy: { requested_at: 'desc' },
    }),
    getAll()
      .then((torrents): { torrents: Torrent[]; error: string | null } => ({ torrents, error: null }))
      .catch((error: unknown): { torrents: Torrent[]; error: string | null } => ({
        torrents: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      })),
    ping(),
    prisma.request.findMany({
      where: {
        status: 'downloading',
        torrent_problem: { not: null },
      },
      orderBy: { requested_at: 'desc' },
    }),
    prisma.job.findFirst({
      where: { type: 'transmission_sync' },
      orderBy: { created_at: 'desc' },
      select: { status: true, error: true, created_at: true, completed_at: true },
    }),
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

  const banner = (
    <TransmissionStatusBanner
      state={transmissionState}
      error={torrentsResult.error ?? pingResult.error ?? null}
      torrentCount={torrentsResult.error ? null : torrentsResult.torrents.length}
      lastSync={
        lastSyncJob
          ? {
              status: lastSyncJob.status,
              error: lastSyncJob.error,
              createdAt: lastSyncJob.created_at.toISOString(),
              completedAt: lastSyncJob.completed_at?.toISOString() ?? null,
            }
          : null
      }
    />
  );

  const typedRequests = requests.map(toRequestModel);
  const typedNeedsAttention = needsAttention.map(toRequestModel);
  const mergedRequests = [...typedRequests, ...typedNeedsAttention.filter((attention) =>
    !typedRequests.some((request) => request.id === attention.id)
  )];
  const total = mergedRequests.length;

  if (total === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Needs Match</h1>
        {banner}
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface/50 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">All requests have been matched</p>
          <Link href="/" className="mt-2 inline-block text-sm font-medium text-accent hover:text-accent-hover">
            Back to search →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Needs Match</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mergedRequests.length} request{mergedRequests.length !== 1 ? 's' : ''} need{mergedRequests.length === 1 ? 's' : ''} a torrent assigned
            {typedNeedsAttention.length > 0 && (
              <> — {typedNeedsAttention.length} need{typedNeedsAttention.length === 1 ? 's' : ''} attention</>
            )}
          </p>
        </div>
        <RefreshButton />
      </div>

      {banner}

      <NeedsMatchView requests={mergedRequests} torrents={torrentsResult.torrents} />
    </main>
  );
}
