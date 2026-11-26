'use client';

import Link from 'next/link';
import { useActionState, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { signIn } from '../actions';
import s from '../auth.module.css';

type Field = 'email' | 'password';

// error and message arrive in the address from other pages (confirm your email, an expired link, ...)
export function LoginForm({ next, error, message }: { next: string; error?: string; message?: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  const [v, setV] = useState({ email: '', password: '' });
  const [tried, setTried] = useState(false);

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

  const field = (name: Field, label: string, props: InputHTMLAttributes<HTMLInputElement>) => {
    const wrong = tried ? missing[name] : '';
    return (
      <div className={s.field}>
        <label htmlFor={name}>{label}</label>
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
        {wrong && <span id={`${name}-error`} className={s.fieldError} role="alert">{wrong}</span>}
      </div>
    );
  };

  return (
    <form className={s.form} action={action} onSubmit={check} noValidate>
      <input type="hidden" name="next" value={next} />
      {problem && <p className={s.formError} role="alert">{problem}</p>}
      {notice && <p className={s.formNotice} role="status">{notice}</p>}
      {/* Autofill stays off on purpose: sign-in often happens on a shared office computer */}
      {field('email', 'Work email', { type: 'email', autoComplete: 'off' })}
      {field('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
      <Link href="/forgot-password" className={s.forgot}>Forgot password?</Link>
      <button type="submit" className={s.submit} disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
