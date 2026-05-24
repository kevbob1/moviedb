'use client';

import { Request } from './RequestListItem';
import RequestListItem from './RequestListItem';

interface RequestListProps {
  requests: Request[];
  jellyfinAvailability: Record<number, boolean>;
}

export default function RequestList({ requests, jellyfinAvailability }: RequestListProps) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No requests yet
      </div>
    );
  }

  return (
    <div className="divide-y">
      {requests.map((request) => (
        <RequestListItem
          key={request.id}
          request={request}
          jellyfinAvailable={jellyfinAvailability[request.id] ?? false}
        />
      ))}
    </div>
  );
}

export type { Request };