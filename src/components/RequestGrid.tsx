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
}

interface Props {
  requests: Request[];
  onJellyfin: (tmdbId: number | null) => boolean;
}

export function RequestGrid({ requests, onJellyfin }: Props) {
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
          onJellyfin={onJellyfin}
        />
      ))}
    </div>
  );
}
