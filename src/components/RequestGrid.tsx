'use client';

import { RequestCard } from './RequestCard';

interface Request {
  id: number;
  title: string;
  tmdb_id: number | null;
  poster_path: string | null;
  requested_at: Date;
  requested_by: string;
  status: 'pending' | 'downloading' | 'fulfilled';
  media_type: string;
  overview?: string;
  release_date?: string;
  genre_ids?: number[];
}

export type { Request };

interface Props {
  requests: Request[];
  jellyfinAvailability: Record<number, boolean>;
}

export function RequestGrid({ requests, jellyfinAvailability }: Props) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No requests yet
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {requests.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          jellyfinAvailable={!!jellyfinAvailability[request.tmdb_id ?? 0]}
        />
      ))}
    </div>
  );
}