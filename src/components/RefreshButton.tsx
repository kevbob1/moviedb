'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function RefreshButton() {
  const router = useRouter();
  return (
    <Button onClick={() => router.refresh()} variant="primary" size="sm">
      Refresh
    </Button>
  );
}
