import { notFound } from 'next/navigation';
import { AuthShell } from '../../auth-shell';
import { Wizard } from '../../onboarding/wizard';

// Look at the setup screens on your own computer without signing in. Sample details, nothing is saved,
// and the page does not exist on the live site. (Under /signup so it is reachable while signed out.)
const SAMPLE = { name: 'Your Name', address: '', phone: '9800000000', email: 'you@example.com', business: 'Sample Business' };
const APPS = [{ key: 'attendance', name: 'HRIS' }, { key: 'finance', name: 'Finance' }, { key: 'marketing', name: 'Marketing' }, { key: 'stock', name: 'Stock Manager' }];

export default function SetupPreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <AuthShell wide aside="Preview: sample details, nothing is saved">
      <Wizard preview initial={SAMPLE} services={APPS} />
    </AuthShell>
  );
}
