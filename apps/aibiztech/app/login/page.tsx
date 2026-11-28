import type { Metadata } from 'next';
import 'lenis/dist/lenis.css';
import Link from 'next/link';
import { ReactLenis } from 'lenis/react';
import { safeNext } from '@/lib/safe-next';
import { TRIAL_DAYS } from '@/lib/signup';
import { fontVariables } from '../fonts';
import type { Search } from '../notice';
import { LoginForm } from './form';
import s from './login.module.css';
import { Showcase } from './showcase';

export const metadata: Metadata = { title: 'Sign in · AIBIZTECH' };

export default async function Login({ searchParams }: { searchParams: Search }) {
  const { error, message, next } = await searchParams;
  const invited = safeNext(next).startsWith('/invite/');
  const { NEXT_PUBLIC_TERMS_URL: terms, NEXT_PUBLIC_PRIVACY_URL: privacy } = process.env;

  return (
    <div className={`${s.page} ${fontVariables}`}>
      <ReactLenis root options={{ anchors: true }} />
      <header className={s.header}>
        <span>New to AIBIZTECH?</span>
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'} className={s.cta}>
          {invited ? 'Create an account' : `Start ${TRIAL_DAYS} days free`} <span aria-hidden="true">→</span>
        </Link>
      </header>

      <main className={s.split}>
        <section className={s.entry}>
          <div className={s.column}>
            <div className={s.brand}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-large.png" alt="AIBIZTECH" width={720} height={423} />
            </div>
            <div className={s.intro}>
              <p className={s.badge}><i aria-hidden="true" />All-in-one business operating system</p>
              <h1>Sign in to your workspace</h1>
              <p>{invited ? 'Sign in to join the business that invited you.' : 'Attendance, finance and stock for your business.'}</p>
            </div>

            <LoginForm next={next ?? ''} error={error} message={message} />

            {terms && privacy && (
              <p className={s.legal}><a href={terms} target="_blank" rel="noopener">Terms of Service</a> · <a href={privacy} target="_blank" rel="noopener">Privacy Policy</a></p>
            )}
          </div>
        </section>

        <Showcase />
      </main>
    </div>
  );
}
