'use client';
import { useState } from 'react';

export function PasswordInput(props: { name: string; autoComplete?: string; minLength?: number; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw">
      <input {...props} type={show ? 'text' : 'password'} required />
      <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? '🙈' : '👁'}
      </button>
    </span>
  );
}
