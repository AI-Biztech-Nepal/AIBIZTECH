import 'lenis/dist/lenis.css';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { ReactLenis } from 'lenis/react';
import type { ReactNode } from 'react';
import s from './auth.module.css';

const body = Inter({ subsets: ['latin'], variable: '--font-body' });
const display = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-display' });

// The charcoal header and ruled page shared by sign-up and sign-in
export function AuthShell({ aside, narrow = false, children }: { aside: ReactNode; narrow?: boolean; children: ReactNode }) {
  return (
    <div className={`${s.page} ${body.variable} ${display.variable}`}>
      <ReactLenis root options={{ anchors: true }} />
      <header className={s.header}>
        {/* The logo file is one tall picture; the mark and the wordmark are shown side by side by cropping it */}
        <span className={s.logo} role="img" aria-label="AIBIZTECH">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className={s.mark}><img src="/logo.png" alt="" /></span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className={s.word}><img src="/logo.png" alt="" /></span>
        </span>
        <p>{aside}</p>
      </header>

      <main className={`${s.main}${narrow ? ` ${s.narrow}` : ''}`}>
        <div className={s.column}>{children}</div>
      </main>
    </div>
  );
}
