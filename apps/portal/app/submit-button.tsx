'use client';

import { useFormStatus } from 'react-dom';

// Server-action forms give no feedback until the redirect lands; this shows it immediately and blocks double submits.
// aria-disabled (not disabled) so keyboard focus stays on the button while it works.
export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} aria-disabled={pending} aria-busy={pending} onClick={(e) => pending && e.preventDefault()}>{children}</button>;
}
