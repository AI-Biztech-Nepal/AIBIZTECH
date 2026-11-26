import { notFound } from 'next/navigation';
import { AuthShell } from '../../auth-shell';
import { Wizard } from '../../onboarding/wizard';

// Look at the setup screens on your own computer without signing in. Sample details, nothing is saved,
// and the page does not exist on the live site. (Under /signup so it is reachable while signed out.)
// Add ?step=2 to open on the module choice.
const SAMPLE = { name: 'Your Name', address: '', phone: '9800000000', email: 'you@example.com', business: 'Sample Business' };
const APPS = [{ key: 'attendance', name: 'HRIS' }, { key: 'finance', name: 'Finance' }, { key: 'marketing', name: 'Marketing' }, { key: 'stock', name: 'Stock Manager' }];

export default async function SetupPreview({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { step } = await searchParams;
  return (
    <AuthShell wide aside="Preview: sample details, nothing is saved">
      <Wizard key={step ?? ''} preview startAt={step === '2' ? 1 : 0} initial={SAMPLE} services={APPS} />
    </AuthShell>
  );
}
