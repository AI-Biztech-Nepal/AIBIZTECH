import { notFound } from 'next/navigation';

const PAGES = ['dashboard', 'plans', 'billing', 'trial-ended'];
const ACCOUNT = ['business', 'team', 'apps', 'settings'];

// A preview page inside a phone-sized window, to look at the phone version from a computer. Add ?page= with one of
// the names above to see the others. It does not exist on the live site.
export default async function PhonePreview({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { page = '' } = await searchParams;
  const src = ACCOUNT.includes(page) ? `/signup/account-preview?page=${page}` : `/signup/${PAGES.includes(page) ? page : PAGES[0]}-preview`;
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', overflow: 'auto', background: '#d9ddea' }}>
      <iframe src={src} title="Phone preview" style={{ boxSizing: 'content-box', width: 390, height: 'min(844px, calc(100vh - 56px))', border: '10px solid #111318', borderRadius: 32, background: '#ffffff' }} />
    </div>
  );
}
