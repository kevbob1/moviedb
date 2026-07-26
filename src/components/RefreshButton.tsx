'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export function RefreshButton() {
  const router = useRouter();
  return (
    <Button onClick={() => router.push('/needs-match?refresh=1')} variant="primary" size="sm">
      Refresh
    </Button>
  );
}
