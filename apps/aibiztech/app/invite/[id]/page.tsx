import { redirect } from 'next/navigation';
import { getContext } from '@/lib/supabase';
import { acceptInvitation, signOut } from '../../actions';
import { Notice, type Search } from '../../notice';

type Preview = { org_name: string; email: string; org_role: string; state: 'open' | 'accepted' | 'expired' };

export default async function Invite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, ctx } = await getContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(`/invite/${id}`)}`);

  const [{ data }, { data: claims }] = await Promise.all([
    supabase.schema('core').rpc('invitation_preview', { p_id: id }),
    supabase.auth.getClaims(),
  ]);
  const invite = (data as Preview[] | null)?.[0];
  const me = claims?.claims.email ?? '';

  // Why the invitation cannot be accepted right now, if it cannot
  const problem = !invite ? 'This invitation link is not valid.'
    : invite.state === 'accepted' ? 'This invitation has already been used.'
    : invite.state === 'expired' ? 'This invitation has expired. Ask your organization admin for a new one.'
    : ctx.orgs.length > 0 ? 'You already belong to an organization. An account can belong to one organization for now.'
    : invite.email.toLowerCase() !== me.toLowerCase() ? `This invitation is for ${invite.email}, but you are signed in as ${me}.`
    : null;

  return (
    <main className="card">
      <h1>Join an organization</h1>
      <Notice error={error} />
      {invite && (
        <p><strong>{invite.org_name}</strong> invited you to join as {invite.org_role === 'admin' ? 'an admin' : 'a member'}.</p>
      )}
      {problem ? (
        <>
          <p role="alert" className="error">{problem}</p>
          <form action={signOut}><button className="link">Sign out</button></form>
        </>
      ) : (
        <form action={acceptInvitation}>
          <input type="hidden" name="id" value={id} />
          <button>Accept invitation</button>
        </form>
      )}
    </main>
  );
}
