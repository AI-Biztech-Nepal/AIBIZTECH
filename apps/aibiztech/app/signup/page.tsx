import { AuthLogo } from '../auth-logo';
import Link from 'next/link';
import { signUp } from '../actions';
import { Notice, type Search } from '../notice';
import { PasswordInput } from '../password-input';

export default async function SignUp({ searchParams }: { searchParams: Search }) {
  const { error, next } = await searchParams;
  return (
    <main className="card auth">
      <AuthLogo />
      <h1>Create Your Account</h1>
      <Notice error={error} />
      <form action={signUp}>
        <input type="hidden" name="next" value={next ?? ''} />
        <label><span>Your Name <b className="req">*</b></span><input name="full_name" autoComplete="name" placeholder="Your name" required /></label>
        <label><span>Company Name <small>(Optional)</small></span><input name="company" autoComplete="organization" placeholder="Printed on your bills (optional)" /></label>
        <label><span>Address <b className="req">*</b></span><input name="address" autoComplete="street-address" placeholder="Your address" required /></label>
        <label><span>Phone Number <b className="req">*</b></span><input name="phone" type="tel" autoComplete="tel" placeholder="98XXXXXXXX" required /></label>
        <label><span>Email <b className="req">*</b></span><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
        <label><span>Password <b className="req">*</b></span><PasswordInput name="password" autoComplete="new-password" minLength={8} placeholder="••••••••" /><small>At least 8 characters, with letters and numbers.</small></label>
        <label><span>Confirm Password <b className="req">*</b></span><PasswordInput name="confirm_password" autoComplete="new-password" minLength={8} placeholder="••••••••" /></label>
        <button className="primary">Create Account</button>
      </form>
      <p className="center">Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Sign in</Link></p>
    </main>
  );
}
