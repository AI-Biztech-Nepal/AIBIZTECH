'use client';

import { useLayoutEffect } from 'react';

// The sidebar is drawn again on every page, so its dropdowns would start closed each time. This remembers which ones
// are open (for this browser tab) and always keeps open the dropdown that holds the page you are on.
const KEY = 'aibiztech:menu:';
const store = (): Storage | null => { try { return window.sessionStorage; } catch { return null; } };

export function SidebarMemory() {
  useLayoutEffect(() => {
    const s = store();
    const menus = Array.from(document.querySelectorAll<HTMLDetailsElement>('details[data-menu]'));
    for (const d of menus) {
      const saved = s?.getItem(KEY + d.dataset.menu);
      if (saved === '1') d.open = true;
      else if (saved === '0') d.open = false;
    }
    // the dropdowns above the page you are on stay open
    const here = window.location.pathname.replace(/\/$/, '') || '/';
    for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>('aside nav a[href]'))) {
      const path = a.pathname.replace(/\/$/, '') || '/';
      if (path !== here || here === '/') continue;
      for (let el = a.parentElement; el; el = el.parentElement) {
        if (el instanceof HTMLDetailsElement && el.dataset.menu) { el.open = true; s?.setItem(KEY + el.dataset.menu, '1'); }
      }
    }
    // remember every open / close the person does
    const onToggle = (e: Event) => {
      const d = e.target;
      if (d instanceof HTMLDetailsElement && d.dataset.menu) s?.setItem(KEY + d.dataset.menu, d.open ? '1' : '0');
    };
    document.addEventListener('toggle', onToggle, true);
    return () => document.removeEventListener('toggle', onToggle, true);
  }, []);
  return null;
}
