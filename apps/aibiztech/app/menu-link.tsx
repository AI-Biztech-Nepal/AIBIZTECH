'use client';

import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';
import s from './frame.module.css';

// A side panel link to an app's page: the portal stays on screen and only the page area changes
export function MenuLink({ href, children, onClick, ...rest }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  function press(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    // Already on this address, though the app inside may have moved on: load it afresh to get back to this page
    if (e.currentTarget.pathname === window.location.pathname) { e.preventDefault(); window.location.assign(href); }
  }
  return <Link {...rest} href={href} prefetch={false} onClick={press}>{children}<Waiting /></Link>;
}

// Shown on the pressed link until its page arrives
function Waiting() {
  return useLinkStatus().pending ? <span className={s.waiting} role="status" aria-label="Opening" /> : null;
}
