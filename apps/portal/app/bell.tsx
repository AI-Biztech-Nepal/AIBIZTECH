'use client';

import { useEffect, useRef } from 'react';
import { SubmitButton } from '@/app/submit-button';
import { markNotificationsRead } from './actions';

export type Note = { id: number | string; title: string; body: string | null; when: string; read: boolean };

export function Bell({ notes, unread, orgId }: { notes: Note[]; unread: number; orgId: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  // <details> does not close itself on outside click or Escape
  useEffect(() => {
    const away = (e: PointerEvent) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false; };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !ref.current?.open) return;
      ref.current.open = false;
      ref.current.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, []);

  return (
    <details className="bell" ref={ref}>
      <summary aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && <span className="bell-count" aria-hidden>{unread > 9 ? '9+' : unread}</span>}
      </summary>
      <div className="bell-panel">
        <div className="block-head">
          <h2>Notifications</h2>
          {unread > 0 && (
            <form action={markNotificationsRead}>
              <input type="hidden" name="org_id" value={orgId} />
              <SubmitButton className="link">Mark all read</SubmitButton>
            </form>
          )}
        </div>
        {notes.length === 0 ? (
          <p className="sub">Nothing yet. Trial and subscription notices show up here.</p>
        ) : (
          <ul>
            {notes.map((n) => (
              <li key={n.id} className={n.read ? '' : 'unread'}>
                <strong>{n.title}</strong>
                {n.body && <span className="sub">{n.body}</span>}
                <time className="sub">{n.when}</time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
