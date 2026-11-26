'use client';

import { useActionState, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { signUp } from '../actions';
import { longEnough, mixed, validateSignup, type SignupField, type SignupValues } from '@/lib/signup';
import s from '../auth.module.css';

const EMPTY: SignupValues = { full_name: '', business_name: '', email: '', phone: '', password: '', confirm_password: '' };

export function SignupForm({ next, invited, termsUrl, privacyUrl }: { next: string; invited: boolean; termsUrl?: string; privacyUrl?: string }) {
  const [state, action, pending] = useActionState(signUp, {});
  // Held here, so nothing typed is lost when the server turns the sign-up down
  const [v, setV] = useState(EMPTY);
  const [tried, setTried] = useState(false);
  const [show, setShow] = useState(false);

  const problems = validateSignup(v, invited);
  const errors: Partial<SignupValues> = tried ? { ...problems } : {};
  // A mismatch is worth saying before submit, once the second password is long enough to compare
  if (v.confirm_password && v.confirm_password.length >= v.password.length && problems.confirm_password) errors.confirm_password = problems.confirm_password;

  function check(e: FormEvent<HTMLFormElement>) {
    setTried(true);
    const first = Object.keys(problems)[0];
    if (!first) return;
    e.preventDefault();
    (e.currentTarget.elements.namedItem(first) as HTMLInputElement).focus();
  }

  const field = (name: SignupField, label: string, props: InputHTMLAttributes<HTMLInputElement>, below?: React.ReactNode) => (
    <div className={s.field}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        value={v[name]}
        onChange={(e) => setV({ ...v, [name]: e.target.value })}
        required
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        {...props}
      />
      {below}
      {errors[name] && <span id={`${name}-error`} className={s.fieldError} role="alert">{errors[name]}</span>}
    </div>
  );

  const rule = (met: boolean, text: string) => <li className={met ? s.met : undefined}><span aria-hidden="true">{met ? '✓' : '·'}</span> {text}{met && <span className={s.hidden}> (done)</span>}</li>;
  const password = { type: show ? 'text' : 'password', autoComplete: 'new-password', minLength: 8 };

  return (
    // noValidate: our own messages replace the browser's pop-ups; the server checks the same rules without JavaScript
    <form className={s.form} action={action} onSubmit={check} noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error && <p className={s.formError} role="alert">{state.error}</p>}

      <div className={s.fields}>
        {field('full_name', 'Full name', { autoComplete: 'name', maxLength: 120 })}
        {!invited && field('business_name', 'Business or organization name', { autoComplete: 'organization', maxLength: 120 })}
        {field('email', 'Work email', { type: 'email', autoComplete: 'email', placeholder: 'name@business.com', maxLength: 254 })}
        {field('phone', 'Phone number', { type: 'tel', autoComplete: 'tel', placeholder: '98XXXXXXXX', maxLength: 20 })}
        {field('password', 'Password', password, (
          <ul className={s.rules}>
            {rule(longEnough(v.password), 'At least 8 characters')}
            {rule(mixed(v.password), 'Letters and numbers')}
          </ul>
        ))}
        {field('confirm_password', 'Confirm password', password, (
          <button type="button" className={s.toggle} onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide passwords' : 'Show passwords'}</button>
        ))}
      </div>

      <div className={s.actions}>
        <button type="submit" className={s.submit} disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</button>
        {termsUrl && privacyUrl && (
          <p>By creating an account you agree to the <a href={termsUrl} target="_blank" rel="noopener">Terms of Service</a> and <a href={privacyUrl} target="_blank" rel="noopener">Privacy Policy</a>.</p>
        )}
      </div>
    </form>
  );
}
