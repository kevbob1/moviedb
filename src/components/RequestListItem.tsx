'use client';

import { useSyncExternalStore } from 'react';

import { Request } from '@/types/request';

import RequestCard from './RequestCard';

interface RequestListItemProps {
  request: Request;
  onRemoved?: () => void;
  jellyfinAvailable?: boolean;
}

export function RequestListItem({ request, onRemoved, jellyfinAvailable = false }: RequestListItemProps) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const formattedDate = mounted
    ? new Date(request.requested_at).toLocaleDateString()
    : new Date(request.requested_at).toLocaleDateString('en-US', { timeZone: 'UTC' });

  return (
    <RequestCard
      request={request}
      jellyfinAvailable={jellyfinAvailable}
      formattedDate={formattedDate}
      onAfterCancel={onRemoved}
    />
  );
}