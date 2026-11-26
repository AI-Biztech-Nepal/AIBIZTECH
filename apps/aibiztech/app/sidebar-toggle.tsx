'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Icon } from './icons';

// Two states kept on <html> so the frame's CSS can read them: collapsed (wide screens, remembered)
// and open (phones, closes again on the next page)
const KEY = 'aibiztech:sidebar-collapsed';
const root = () => document.documentElement;

export function CollapseButton({ className }: { className: string }) {
  const [collapsed, setCollapsed] = useState(false);
  useLayoutEffect(() => {
    let saved = false;
    try { saved = localStorage.getItem(KEY) === '1'; } catch {}
    root().toggleAttribute('data-sidebar-collapsed', saved);
    setCollapsed(saved);
  }, []);
  function flip() {
    const next = !collapsed;
    root().toggleAttribute('data-sidebar-collapsed', next);
    try { localStorage.setItem(KEY, next ? '1' : '0'); } catch {}
    setCollapsed(next);
  }
  return (
    <button type="button" className={className} onClick={flip} aria-pressed={collapsed} aria-label={collapsed ? 'Expand side panel' : 'Collapse side panel'}>
      <Icon name="panel" size={17} />
    </button>
  );
}

// With a label it is the "More" button of the phones' bottom bar
export function MenuButton({ className, label }: { className: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { root().toggleAttribute('data-sidebar-open', open); }, [open]);
  // Any link closes it, also the one for the page you are already on
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if ((e.target as Element).closest('a')) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);
  return (
    <button type="button" className={className} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={label ? undefined : 'Menu'}>
      <Icon name={label ? 'more' : 'menu'} size={20} />{label && <span>{label}</span>}
    </button>
  );
}
