import type { ReactNode } from 'react';

const P = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

const paths: Record<string, ReactNode> = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  address: <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  lockcheck: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3M9.5 16l2 2 3.5-3.5" /></>,
  finance: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M7 16l3.5-4 3 2.5L18 8" /><path d="M14.5 8H18v3.5" /></>,
  attendance: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18M8.5 15.5l2.2 2.2 4.3-4.4" /></>,
  stock: <><path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9" /></>,
  app: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 12h8M12 8v8" /></>,
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg {...P} width={size} height={size}>{paths[name] ?? paths.app}</svg>;
}

export function serviceIcon(key: string, name: string) {
  const s = `${key} ${name}`.toLowerCase();
  return s.includes('financ') ? 'finance' : s.includes('attend') ? 'attendance' : s.includes('stock') ? 'stock' : 'app';
}

export function ServiceLogo({ svc }: { svc: { key: string; name: string } }) {
  return <span className="svc-logo"><Icon name={serviceIcon(svc.key, svc.name)} size={30} /></span>;
}
