import type { Metadata } from 'next';
import Link from 'next/link';
import { safeNext } from '@/lib/safe-next';
import { TRIAL_DAYS } from '@/lib/signup';
import { AuthShell } from '../auth-shell';
import type { Search } from '../notice';
import { LoginForm } from './form';
import s from '../auth.module.css';

export const metadata: Metadata = { title: 'Sign in · AIBIZTECH' };

export default async function Login({ searchParams }: { searchParams: Search }) {
  const { error, message, next } = await searchParams;
  const invited = safeNext(next).startsWith('/invite/');
  const { NEXT_PUBLIC_TERMS_URL: terms, NEXT_PUBLIC_PRIVACY_URL: privacy } = process.env;

  return (
    <AuthShell narrow aside={<>New to AIBIZTECH? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}>{invited ? 'Create an account' : `Start ${TRIAL_DAYS} days free`}</Link></>}>
      <div className={s.intro}>
        <h1>Sign in to your workspace</h1>
        <p>{invited ? 'Sign in to join the business that invited you.' : 'Attendance, finance and stock for your business.'}</p>
      </div>

      <LoginForm next={next ?? ''} error={error} message={message} />

      {terms && privacy && (
        <p className={s.legal}><a href={terms} target="_blank" rel="noopener">Terms of Service</a> · <a href={privacy} target="_blank" rel="noopener">Privacy Policy</a></p>
      )}
    </AuthShell>
  );
}
