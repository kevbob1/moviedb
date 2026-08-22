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

type SuggestedRequest = Request & { suggestion_hash: string };

function scoreBand(score: number): string {
  if (score >= 0.8) return 'border-emerald-500 bg-emerald-500/10';
  if (score >= 0.5) return 'border-amber-500 bg-amber-500/10';
  return 'border-rose-500 bg-rose-500/10';
}

export function NeedsMatchSuggestion({ request, torrents }: { request: SuggestedRequest; torrents: Torrent[] }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const torrentName = torrents.find((torrent) => torrent.hash === request.suggestion_hash)?.name ?? request.suggestion_hash;
  const score = request.suggestion_score ?? 0;

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await linkTorrent(request.id, request.suggestion_hash);
      router.refresh();
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div
      className={`mt-3 flex flex-col gap-3 rounded-xl border-l-4 p-3 sm:flex-row sm:items-center sm:justify-between ${scoreBand(score)}`}
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested match</p>
        <p className="truncate text-sm text-foreground" title={torrentName}>{torrentName}</p>
        <p className="text-xs text-muted-foreground">Score: {score.toFixed(2)}</p>
      </div>
      <Button
        size="sm"
        variant="primary"
        loading={accepting}
        disabled={accepting}
        aria-label={`Accept suggested match for ${request.title}: ${torrentName}`}
        onClick={handleAccept}
      >
        Accept
      </Button>
    </div>
  );
}

export function NeedsMatchSuggestions({ requests, torrents }: NeedsMatchSuggestionsProps) {
  const router = useRouter();
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  const suggestions = requests.filter((request): request is SuggestedRequest =>
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
