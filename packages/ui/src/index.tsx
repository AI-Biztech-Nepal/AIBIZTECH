import type { ReactNode } from 'react';

export type AppLink = { key: string; name: string; url: string };

// Header every service shows: app switcher (services the person can open), org name, and sign-out at the portal
export function PlatformHeader({ portalUrl, orgName, current, apps, children }: {
  portalUrl: string;
  orgName: string;
  current: string;
  apps: AppLink[];
  children?: ReactNode;
}) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
      <a href={portalUrl} style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>AIBIZTECH</a>
      <nav aria-label="Services" style={{ display: 'flex', gap: 12 }}>
        {apps.map((a) => (
          <a key={a.key} href={a.url} aria-current={a.key === current ? 'page' : undefined}
            style={{ color: a.key === current ? 'var(--accent)' : 'var(--muted)', fontWeight: a.key === current ? 600 : 400 }}>{a.name}</a>
        ))}
      </nav>
      <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>{orgName}</span>
      {children}
    </header>
  );
}
