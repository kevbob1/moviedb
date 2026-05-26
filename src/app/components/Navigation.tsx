'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function Navigation() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isRequests = pathname === '/requests';

  return (
    <div className="flex-1 flex justify-end items-center gap-4">
      {!isHome && (
        <Link
          href="/"
          className="nav-link"
        >
          Home
        </Link>
      )}
      {!isRequests && (
        <Link
          href="/requests"
          className="nav-link"
        >
          View Requests
        </Link>
      )}
    </div>
  );
}
