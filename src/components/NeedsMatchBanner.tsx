'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function NeedsMatchBanner() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/requests/needs-match')
      .then(res => res.json())
      .then(data => setCount(data.count ?? 0))
      .catch(() => setCount(0));
  }, []);

  if (count === null || count === 0) return null;

  return (
    <Link
      href="/needs-match"
      className="mb-6 block rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
    >
      {count} request{count !== 1 ? 's' : ''} need{count === 1 ? 's' : ''} a torrent assigned — view needs match
    </Link>
  );
}
