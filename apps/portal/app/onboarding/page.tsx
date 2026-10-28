import { createOrganization } from '../actions';
import { Notice, type Search } from '../notice';

export default async function Onboarding({ searchParams }: { searchParams: Search }) {
  const { error } = await searchParams;
  return (
    <main className="card">
      <h1>Set up your organization</h1>
      <p>Your business is the organization. You can invite your team after this.</p>
      <Notice error={error} />
      <form action={createOrganization}>
        <label>Organization name<input name="name" autoComplete="organization" required /></label>
        <button>Create organization</button>
      </form>
    </main>
  );
}
