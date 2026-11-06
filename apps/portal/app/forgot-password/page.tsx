import { SubmitButton } from '@/app/submit-button';
import Link from 'next/link';
import { forgotPassword } from '../actions';
import { Notice, type Search } from '../notice';

export default async function ForgotPassword({ searchParams }: { searchParams: Search }) {
  const { error } = await searchParams;
  return (
    <main className="card">
      <h1>Reset your password</h1>
      <Notice error={error} />
      <form action={forgotPassword}>
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <SubmitButton>Send reset link</SubmitButton>
      </form>
      <p><Link href="/login">Back to sign in</Link></p>
    </main>
  );
}
