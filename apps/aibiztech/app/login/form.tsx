'use client';

import Link from 'next/link';
import { useActionState, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { signIn } from '../actions';
import s from './login.module.css';

type Field = 'email' | 'password';

// error and message arrive in the address from other pages (confirm your email, an expired link, ...)
export function LoginForm({ next, error, message }: { next: string; error?: string; message?: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  const [v, setV] = useState({ email: '', password: '' });
  const [tried, setTried] = useState(false);
  const [show, setShow] = useState(false);

  const missing = { email: v.email.trim() ? '' : 'Enter your email.', password: v.password ? '' : 'Enter your password.' };
  // Once the person tries, the answer to this attempt replaces the notice they arrived with
  const problem = state.error ?? (tried ? undefined : error);
  const notice = tried || state.error ? undefined : message;

  function check(e: FormEvent<HTMLFormElement>) {
    setTried(true);
    const first = (['email', 'password'] as const).find((name) => missing[name]);
    if (!first) return;
    e.preventDefault();
    (e.currentTarget.elements.namedItem(first) as HTMLInputElement).focus();
  }

  const field = (name: Field, label: string, props: InputHTMLAttributes<HTMLInputElement>, aside?: ReactNode, inside?: ReactNode) => {
    const wrong = tried ? missing[name] : '';
    return (
      <div className={s.field}>
        <div className={s.labelRow}><label htmlFor={name}>{label}</label>{aside}</div>
        <div className={s.box}>
          <input
            id={name}
            name={name}
            value={v[name]}
            onChange={(e) => setV({ ...v, [name]: e.target.value })}
            required
            aria-invalid={!!wrong}
            aria-describedby={wrong ? `${name}-error` : undefined}
            {...props}
          />
          {inside}
        </div>
        {wrong && <span id={`${name}-error`} className={s.fieldError} role="alert">{wrong}</span>}
      </div>
    );
  };

  const eye = (
    <button type="button" className={s.eye} onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 12C3.7 8 7.5 5 12 5s8.3 3 9.5 7c-1.2 4-5 7-9.5 7s-8.3-3-9.5-7z" /><circle cx="12" cy="12" r="3" />{show && <path d="M4 4l16 16" />}
      </svg>
    </button>
  );

  return (
    <form className={s.form} action={action} onSubmit={check} noValidate>
      <input type="hidden" name="next" value={next} />
      {problem && <p className={s.formError} role="alert">{problem}</p>}
      {notice && <p className={s.formNotice} role="status">{notice}</p>}
      {/* Autofill stays off on purpose: sign-in often happens on a shared office computer */}
      {field('email', 'Work email', { type: 'email', autoComplete: 'off', placeholder: 'name@company.com' })}
      {field('password', 'Password', { type: show ? 'text' : 'password', autoComplete: 'new-password', placeholder: 'Enter your password' },
        <Link href="/forgot-password" className={s.forgot}>Forgot password?</Link>, eye)}
      <button type="submit" className={s.submit} disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
