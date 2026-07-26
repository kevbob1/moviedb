import { prisma } from '@/lib/prisma';
import { getAll, refreshCatalog } from '@/lib/transmission';
import { toRequestModel } from '@/lib/request-utils';
import { Surface } from '@/components/ui/Surface';
import { RefreshButton } from '@/components/RefreshButton';
import Link from 'next/link';

function formatProgress(pct: number): string {
  return `${Math.round(pct * 100)}%`;
}

function statusLabel(status: number): string {
  const labels: Record<number, string> = {
    0: 'Stopped',
    1: 'Check Wait',
    2: 'Checking',
    3: 'Download Wait',
    4: 'Downloading',
    5: 'Seed Wait',
    6: 'Seeding',
  };
  return labels[status] ?? `Unknown (${status})`;
}

export default async function NeedsMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ refresh?: string }>;
}) {
  const params = await searchParams;

  if (params.refresh === '1') {
    refreshCatalog();
  }

  const [requests, torrents] = await Promise.all([
    prisma.request.findMany({
      where: {
        status: 'pending',
        torrent_hash: null,
      },
      orderBy: { requested_at: 'desc' },
    }),
    getAll(),
  ]);

  const typedRequests = requests.map(toRequestModel);

  if (typedRequests.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Needs Match</h1>
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
            {typedRequests.length} request{typedRequests.length !== 1 ? 's' : ''} need{typedRequests.length === 1 ? 's' : ''} a torrent assigned
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="flex-1">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Unmatched Requests</h2>
          {typedRequests.map((request) => (
            <Surface key={request.id} elevation="raised" className="mb-3 p-3 sm:p-4">
              <h3 className="text-base font-semibold text-foreground">{request.title}</h3>
              {request.season_number && (
                <p className="text-sm text-muted-foreground">Season {request.season_number}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Requested by {request.requested_by}
              </p>
            </Surface>
          ))}
        </div>

        <div className="flex-1">
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Transmission Torrents
            <span className="ml-2 text-sm font-normal text-muted-foreground">({torrents.length})</span>
          </h2>
          {torrents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No torrents in Transmission</p>
          ) : (
            torrents.map((torrent) => (
              <Surface key={torrent.hash} elevation="raised" className="mb-3 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-base font-semibold text-foreground">{torrent.name}</h3>
                  <span className="flex-shrink-0 text-xs text-muted-foreground">{formatProgress(torrent.percentDone)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {statusLabel(torrent.status)}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{torrent.hash}</p>
              </Surface>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
