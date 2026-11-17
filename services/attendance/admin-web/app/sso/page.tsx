'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AuthCard from '@/components/AuthCard';

// Landing page for "Open app" in AIBIZTECH: trades the signed token in the URL fragment for a session here
export default function SsoPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    history.replaceState(null, '', window.location.pathname); // keep the token out of history
    if (!token) {
      router.replace('/login');
      return;
    }
    (async () => {
      const res = await fetch('/api/sso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error ?? 'Could not sign you in.');
      const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: json.token_hash, type: 'magiclink' });
      if (otpError) return setError(otpError.message);
      router.replace('/');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthCard>
      {error ? (
        <p className="text-center text-sm text-red-600">{error}</p>
      ) : (
        <p className="text-center text-sm text-slate-500">Signing you in…</p>
      )}
    </AuthCard>
  );
}
