'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/platform', label: 'Overview', exact: true },
  { href: '/platform/orgs', label: 'Organizations', exact: false },
  { href: '/platform/requests', label: 'Feature requests', exact: false },
];

export function PlatformNav() {
  const path = usePathname();
  return (
    <nav aria-label="Platform">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={(i.exact ? path === i.href : path.startsWith(i.href)) ? 'page' : undefined}>{i.label}</Link>
      ))}
    </nav>
  );
}
