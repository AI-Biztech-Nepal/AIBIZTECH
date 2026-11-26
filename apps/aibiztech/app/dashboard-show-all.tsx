'use client';

import { useState } from 'react';

// Phones only: the dashboard's CSS shows the charts and reports while this button says it is expanded
export function ShowAll({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className={className} aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? 'Hide charts and reports' : 'Show charts and reports'}
    </button>
  );
}
