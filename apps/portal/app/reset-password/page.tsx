import { SubmitButton } from '@/app/submit-button';
import { resetPassword } from '../actions';
import { Notice, type Search } from '../notice';

export default async function ResetPassword({ searchParams }: { searchParams: Search }) {
  const { error } = await searchParams;
  return (
    <main className="card">
      <h1>Choose a new password</h1>
      <Notice error={error} />
      <form action={resetPassword}>
        <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <SubmitButton>Save password</SubmitButton>
      </form>
    </main>
  );
}
