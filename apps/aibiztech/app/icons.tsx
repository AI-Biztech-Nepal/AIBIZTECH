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
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  team: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .7 3.5 2.6 3.5 5.7" /></>,
  admin: <><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3z" /><path d="m9 12 2 2 4-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  signout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  lockmini: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  leave: <><path d="M4 20c0-9 6-15 16-16 0 10-6 16-16 16z" /><path d="M4 20c3-5 7-8 11-10" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 8v4l3 2" /></>,
  branch: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="8" r="2.5" /><path d="M6 8.5v7M18 10.5c0 4-6 3-12 6" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  structure: <><rect x="4" y="4" width="16" height="5" rx="1" /><rect x="4" y="11" width="7" height="9" rx="1" /><rect x="13" y="11" width="7" height="9" rx="1" /></>,
  task: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8 12 3 3 5-6" /></>,
  device: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></>,
  megaphone: <><path d="M3 11v2a1 1 0 0 0 1 1h3l8 4V6L7 10H4a1 1 0 0 0-1 1z" /><path d="M18 9a4 4 0 0 1 0 6" /></>,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  spark: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  app: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 12h8M12 8v8" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  more: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg {...P} width={size} height={size}>{paths[name] ?? paths.app}</svg>;
}

export function serviceIcon(key: string, name: string) {
  const s = `${key} ${name}`.toLowerCase();
  return s.includes('financ') ? 'finance' : s.includes('attend') ? 'attendance' : s.includes('stock') ? 'stock' : s.includes('market') ? 'megaphone' : 'app';
}

// Attendance Nepal uses its real logo; Stock Manager uses the StockTrack mark; Finance has a logo drawn for the portal
function FinanceMark() {
  return (
    <svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true">
      <defs>
        <linearGradient id="fb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1e88ff" /><stop offset="1" stopColor="#0b3fa8" /></linearGradient>
        <linearGradient id="fr" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#ff3b30" /><stop offset="1" stopColor="#d3121b" /></linearGradient>
      </defs>
      <path d="M12 58V22C12 11 19 5 30 5h27c-2 5-7 8-14 8H30c-4 0-6 2-6 6v6h22c-2 5-6 8-12 8H24v25z" fill="url(#fb)" />
      <rect x="27" y="25" width="5" height="12" rx="1.5" fill="#fbbf24" /><rect x="34" y="21" width="5" height="16" rx="1.5" fill="#84cc16" />
      <rect x="41" y="17" width="5" height="20" rx="1.5" fill="#22c55e" />
      <path d="M8 46c14-2 30-8 46-22-4 14-20 26-46 30z" fill="url(#fr)" />
    </svg>
  );
}

export function ServiceLogo({ svc }: { svc: { key: string; name: string } }) {
  const kind = serviceIcon(svc.key, svc.name);
  return (
    <span className="svc-logo">
      {kind === 'attendance' ? <img src="/apps/attendance.png" alt="" width={44} height={44} /> : kind === 'stock' ? <img src="/apps/stock.png" alt="" width={52} height={52} /> : kind === 'finance' ? <FinanceMark /> : kind === 'megaphone' ? <Icon name="megaphone" size={30} /> : <Icon name="app" size={30} />}
    </span>
  );
}
