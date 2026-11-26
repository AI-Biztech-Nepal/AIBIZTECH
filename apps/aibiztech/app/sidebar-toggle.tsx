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

export function MenuButton({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { root().toggleAttribute('data-sidebar-open', open); }, [open]);
  return (
    <button type="button" className={className} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
      <Icon name="menu" size={20} />
    </button>
  );
}
