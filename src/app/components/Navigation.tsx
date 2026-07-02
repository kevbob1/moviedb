'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
}

const ITEMS: NavItem[] = [
  { href: '/', label: 'Search', icon: '🔍', match: (p) => p === '/' },
  { href: '/requests', label: 'Requests', icon: '📋', match: (p) => p.startsWith('/requests') },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="ml-auto flex items-center gap-1">
      {ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'relative inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              active
                ? 'text-accent'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated',
            ].join(' ')}
          >
            <span aria-hidden="true" className="text-base leading-none">{item.icon}</span>
            <span className="hidden sm:inline">{item.label}</span>
            {active && <span aria-hidden="true" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </Link>
        );
      })}
    </nav>
  );
}
