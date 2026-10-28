import Link from 'next/link';
import { signUp } from '../actions';
import { Notice, type Search } from '../notice';

export default async function SignUp({ searchParams }: { searchParams: Search }) {
  const { error } = await searchParams;
  return (
    <main className="card">
      <h1>Create an account</h1>
      <Notice error={error} />
      <form action={signUp}>
        <label>Full name<input name="full_name" autoComplete="name" required /></label>
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button>Create account</button>
      </form>
      <p>Already have an account? <Link href="/login">Sign in</Link></p>
    </main>
  );
}
