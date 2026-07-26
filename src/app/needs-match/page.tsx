import { prisma } from '@/lib/prisma';
import { getAll, refreshCatalog } from '@/lib/transmission';
import { toRequestModel } from '@/lib/request-utils';
import { NeedsMatchView } from '@/components/NeedsMatchView';
import { RefreshButton } from '@/components/RefreshButton';
import Link from 'next/link';

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

      <NeedsMatchView requests={typedRequests} torrents={torrents} />
    </main>
  );
}
