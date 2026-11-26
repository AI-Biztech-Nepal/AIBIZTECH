import 'lenis/dist/lenis.css';
import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import Link from 'next/link';
import { ReactLenis } from 'lenis/react';
import { safeNext } from '@/lib/safe-next';
import { TRIAL_DAYS, trialDates } from '@/lib/signup';
import type { Search } from '../notice';
import { SignupForm } from './form';
import s from './signup.module.css';

export const metadata: Metadata = { title: 'Create your account · AIBIZTECH' };

const body = Inter({ subsets: ['latin'], variable: '--font-body' });
const display = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-display' });

const PROMISES = ['No payment required to start', 'Attendance, Finance and Stock included', 'Upgrade whenever you are ready'];

export default async function SignUp({ searchParams }: { searchParams: Search }) {
  const { next } = await searchParams;
  const invited = safeNext(next).startsWith('/invite/');
  const trial = trialDates();

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
        <p>Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Sign in</Link></p>
      </header>

      <main className={s.main}>
        <div className={s.column}>
          <div className={s.intro}>
            <h1>One Platform. Complete Business Control.</h1>
            <p>{invited ? 'Create your account to join the business that invited you.' : 'Manage your people, finances and inventory from one intelligent workspace.'}</p>
          </div>

          {!invited && (
            <section className={s.trial} aria-labelledby="trial-title">
              <div className={s.trialHead}>
                <h2 id="trial-title">Start with {TRIAL_DAYS} Days Free</h2>
                <p>Finish setup today: <strong>{trial.start}</strong> to <strong>{trial.end}</strong></p>
              </div>
              <ol className={s.days}>
                {trial.days.map((day, i) => (
                  <li key={day}><span>{i === 0 ? 'Today' : `Day ${i + 1}`}</span>{day}</li>
                ))}
              </ol>
              <ul className={s.promises}>
                {PROMISES.map((text) => <li key={text}>{text}</li>)}
              </ul>
            </section>
          )}

          <SignupForm next={next ?? ''} invited={invited} termsUrl={process.env.NEXT_PUBLIC_TERMS_URL} privacyUrl={process.env.NEXT_PUBLIC_PRIVACY_URL} />
        </div>
      </main>
    </div>
  );
}
