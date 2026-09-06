import { NeedsMatchView } from '@/components/NeedsMatchView';
import { TransmissionStatusBanner } from '@/components/TransmissionStatusBanner';
import { NeedsMatchSyncControl } from '@/components/NeedsMatchSyncControl';
import Link from 'next/link';
import { readNeedsMatch } from '@/lib/needs-match/read';

export const dynamic = 'force-dynamic';

export default async function NeedsMatchPage() {
  const {
    requests,
    needsAttention,
    torrents,
    transmissionError,
    transmissionState,
    torrentCount,
    lastSync,
  } = await readNeedsMatch();

  const banner = (
    <TransmissionStatusBanner
      state={transmissionState}
      error={transmissionError}
      torrentCount={torrentCount}
      lastSync={lastSync}
    />
  );

  const total = requests.length;

  if (total === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Needs Match</h1>
          <NeedsMatchSyncControl lastSync={lastSync} />
        </div>
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
            {requests.length} request{requests.length !== 1 ? 's' : ''} need{requests.length === 1 ? 's' : ''} a torrent assigned
            {needsAttention.length > 0 && (
              <> — {needsAttention.length} need{needsAttention.length === 1 ? 's' : ''} attention</>
            )}
          </p>
        </div>
        <NeedsMatchSyncControl lastSync={lastSync} />
      </div>

      {banner}

      <NeedsMatchView requests={requests} torrents={torrents} />
    </main>
  );
}
