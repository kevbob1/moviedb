'use client';

import { useRouter } from 'next/navigation';

import RequestCard from '@/components/RequestCard';
import { Request } from '@/types/request';

interface RequestDetailProps {
  request: Request;
  jellyfinAvailable: boolean;
}

export default function RequestDetail({ request, jellyfinAvailable }: RequestDetailProps) {
  const router = useRouter();

  return (
    <RequestCard
      request={request}
      jellyfinAvailable={jellyfinAvailable}
      onAfter={() => router.refresh()}
      onAfterCancel={() => router.push('/requests')}
    />
  );
}