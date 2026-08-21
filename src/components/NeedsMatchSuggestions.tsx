'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { linkTorrent } from '@/app/actions/request-actions';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { Torrent } from '@/lib/transmission/adapter';
import { Request } from '@/types/request';

interface NeedsMatchSuggestionsProps {
  requests: Request[];
  torrents: Torrent[];
}

export function NeedsMatchSuggestions({ requests, torrents }: NeedsMatchSuggestionsProps) {
  const router = useRouter();
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  const suggestions = requests.filter((request): request is Request & { suggestion_hash: string } =>
    Boolean(request.suggestion_hash)
  );

  if (suggestions.length === 0) {
    return null;
  }

  const torrentNames = new Map<string, string>(torrents.map((torrent) => [torrent.hash, torrent.name]));

  const handleAccept = async (request: Request & { suggestion_hash: string }) => {
    setAcceptingId(request.id);
    try {
      await linkTorrent(request.id, request.suggestion_hash);
      router.refresh();
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-foreground">Suggestions</h2>
      {suggestions.map((request) => {
        const torrentName = torrentNames.get(request.suggestion_hash) ?? request.suggestion_hash;
        const score = request.suggestion_score ?? 0;
        const label = `Link '${request.title}' to torrent '${torrentName}' — ${score.toFixed(2)} confidence`;

        return (
          <Surface key={request.id} elevation="raised" className="mb-3 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {request.title}
                  {request.season_number && (
                    <span className="ml-2 font-normal text-muted-foreground">Season {request.season_number}</span>
                  )}
                </h3>
                <p className="truncate text-sm text-muted-foreground">{torrentName}</p>
                <p className="mt-1 text-xs text-muted-foreground">Score: {score.toFixed(2)}</p>
              </div>
              <Button
                size="sm"
                variant="primary"
                loading={acceptingId === request.id}
                disabled={acceptingId === request.id}
                aria-label={label}
                onClick={() => handleAccept(request)}
              >
                Accept
              </Button>
            </div>
          </Surface>
        );
      })}
    </div>
  );
}
