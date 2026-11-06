import Link from 'next/link';
import { platformClient } from '@/lib/platform';
import { SubmitButton } from '@/app/submit-button';
import { signOut } from '../actions';
import { PlatformNav } from './nav';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await platformClient();
  return (
    <div className="pf">
      <aside className="pf-side">
        <strong className="brand"><span className="mark" aria-hidden>AB</span>Platform</strong>
        <PlatformNav />
        <div className="pf-foot">
          <Link href="/">Back to portal</Link>
          <form action={signOut}><SubmitButton className="link">Sign out</SubmitButton></form>
        </div>
      </aside>
      {children}
    </div>
  );
}
