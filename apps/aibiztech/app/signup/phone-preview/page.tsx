import { notFound } from 'next/navigation';

const PAGES = ['dashboard', 'plans', 'billing', 'trial-ended'];

// A preview page inside a phone-sized window, to look at the phone version from a computer. Add ?page=plans,
// ?page=billing or ?page=trial-ended to see the others. It does not exist on the live site.
export default async function PhonePreview({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { page = '' } = await searchParams;
  const shown = PAGES.includes(page) ? page : PAGES[0];
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', overflow: 'auto', background: '#d9ddea' }}>
      <iframe src={`/signup/${shown}-preview`} title="Phone preview" style={{ boxSizing: 'content-box', width: 390, height: 'min(844px, calc(100vh - 56px))', border: '10px solid #111318', borderRadius: 32, background: '#ffffff' }} />
    </div>
  );
}
