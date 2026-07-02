import Link from 'next/link';
import { Request } from '@/types/request';
import { StaggerList } from '@/components/motion/StaggerList';
import { RequestListItem } from './RequestListItem';

interface RequestListProps {
  requests: Request[];
  jellyfinAvailability: Record<number, boolean>;
}

export default function RequestList({ requests, jellyfinAvailability }: RequestListProps) {
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface/50 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">No requests yet</p>
        <Link href="/" className="mt-2 inline-block text-sm font-medium text-accent hover:text-accent-hover">
          Search to add one →
        </Link>
      </div>
    );
  }

  return (
    <StaggerList
      items={requests}
      className="space-y-3"
      renderItem={(request) => (
        <RequestListItem
          key={request.id}
          request={request}
          jellyfinAvailable={jellyfinAvailability[request.tmdb_id ?? 0] ?? false}
        />
      )}
    />
  );
}
