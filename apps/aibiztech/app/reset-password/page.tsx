import { AuthLogo } from '../auth-logo';
import { resetPassword } from '../actions';
import { Notice, type Search } from '../notice';

export default async function ResetPassword({ searchParams }: { searchParams: Search }) {
  const { error } = await searchParams;
  return (
    <main className="card">
      <AuthLogo />
      <h1>Choose a new password</h1>
      <Notice error={error} />
      <form action={resetPassword}>
        <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button>Save password</button>
      </form>
    </main>
  );
}
