import Link from 'next/link';
import { signIn } from '../actions';
import { Notice, type Search } from '../notice';

export default async function Login({ searchParams }: { searchParams: Search }) {
  const { error, message, next } = await searchParams;
  return (
    <main className="card">
      <h1>Sign in</h1>
      <Notice error={error} message={message} />
      <form action={signIn}>
        <input type="hidden" name="next" value={next ?? ''} />
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button>Sign in</button>
      </form>
      <p><Link href="/forgot-password">Forgot password?</Link> · <Link href="/signup">Create an account</Link></p>
    </main>
  );
}
