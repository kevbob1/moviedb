'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export function NeedsMatchBanner() {
  const [needsMatchCount, setNeedsMatchCount] = useState<number | null>(null);
  const [needsAttentionCount, setNeedsAttentionCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/requests/needs-match')
      .then(res => res.json())
      .then(data => {
        setNeedsMatchCount(data.needsMatchCount ?? 0);
        setNeedsAttentionCount(data.needsAttentionCount ?? 0);
      })
      .catch(() => {
        setNeedsMatchCount(0);
        setNeedsAttentionCount(0);
      });
  }, []);

  const total = (needsMatchCount ?? 0) + (needsAttentionCount ?? 0);
  if (needsMatchCount === null || total === 0) return null;

  const parts: string[] = [];
  if (needsMatchCount !== null && needsMatchCount > 0) {
    parts.push(`${needsMatchCount} need${needsMatchCount === 1 ? 's' : ''} a torrent`);
  }
  if (needsAttentionCount !== null && needsAttentionCount > 0) {
    parts.push(`${needsAttentionCount} need${needsAttentionCount === 1 ? 's' : ''} attention`);
  }

  return (
    <Link
      href="/needs-match"
      className="mb-6 block rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/20"
    >
      {parts.join(' — ')} — view needs match
    </Link>
  );
}
