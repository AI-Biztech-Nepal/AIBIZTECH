import { AuthLogo } from '../auth-logo';
import Link from 'next/link';
import { signUp } from '../actions';
import { Notice, type Search } from '../notice';
import { PasswordInput } from '../password-input';
import { Icon } from '../icons';

export default async function SignUp({ searchParams }: { searchParams: Search }) {
  const { error, next } = await searchParams;
  return (
    <main className="card auth">
      <AuthLogo />
      <h1>Create Your Account</h1>
      <Notice error={error} />
      <form action={signUp}>
        <input type="hidden" name="next" value={next ?? ''} />
        <label><span>Your Name <b className="req">*</b></span><span className="ico"><Icon name="user" /><input name="full_name" autoComplete="name" placeholder="Your name" required /></span></label>
        <label><span>Address <b className="req">*</b></span><span className="ico"><Icon name="address" /><input name="address" autoComplete="street-address" placeholder="Your address" required /></span></label>
        <label><span>Phone Number <b className="req">*</b></span><span className="ico"><Icon name="phone" /><input name="phone" type="tel" autoComplete="tel" placeholder="98XXXXXXXX" required /></span></label>
        <label><span>Email <b className="req">*</b></span><span className="ico"><Icon name="email" /><input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></span></label>
        <label><span>Password <b className="req">*</b></span><span className="ico"><Icon name="lock" /><PasswordInput name="password" autoComplete="new-password" minLength={8} placeholder="••••••••" /></span><small>At least 8 characters, with letters and numbers.</small></label>
        <label><span>Confirm Password <b className="req">*</b></span><span className="ico"><Icon name="lockcheck" /><PasswordInput name="confirm_password" autoComplete="new-password" minLength={8} placeholder="••••••••" /></span></label>
        <button className="primary">Create Account</button>
      </form>
      <p className="center">Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Sign in</Link></p>
    </main>
  );
}
