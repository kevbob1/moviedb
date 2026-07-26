'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { linkTorrent } from '@/app/actions/request-actions';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { Torrent } from '@/lib/transmission/adapter';
import { Request } from '@/types/request';

interface NeedsMatchViewProps {
  requests: Request[];
  torrents: Torrent[];
}

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

export function NeedsMatchView({ requests, torrents }: NeedsMatchViewProps) {
  const router = useRouter();
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<number | null>(null);

  const handleLink = async (requestId: number) => {
    if (!selectedHash) return;
    setLinkingId(requestId);
    try {
      await linkTorrent(requestId, selectedHash);
      setSelectedHash(null);
      router.refresh();
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <div className="flex-1">
        <h2 className="mb-3 text-lg font-semibold text-foreground">Unmatched Requests</h2>
        {requests.map((request) => (
          <Surface key={request.id} elevation="raised" className="mb-3 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-foreground">{request.title}</h3>
                {request.season_number && (
                  <p className="text-sm text-muted-foreground">Season {request.season_number}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Requested by {request.requested_by}
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                disabled={!selectedHash || linkingId === request.id}
                loading={linkingId === request.id}
                onClick={() => handleLink(request.id)}
              >
                Link
              </Button>
            </div>
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
          torrents.map((torrent) => {
            const isSelected = selectedHash === torrent.hash;
            return (
              <button
                key={torrent.hash}
                type="button"
                onClick={() => setSelectedHash(isSelected ? null : torrent.hash)}
                className={`mb-3 w-full rounded-2xl border p-3 text-left transition-colors sm:p-4 ${
                  isSelected
                    ? 'border-accent bg-surface-elevated ring-2 ring-accent shadow-lg shadow-black/30'
                    : 'border-border-subtle bg-surface-elevated shadow-lg shadow-black/30 hover:ring-1 hover:ring-border-subtle'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-base font-semibold text-foreground">{torrent.name}</h3>
                  <span className="flex-shrink-0 text-xs text-muted-foreground">{formatProgress(torrent.percentDone)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {statusLabel(torrent.status)}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{torrent.hash}</p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
