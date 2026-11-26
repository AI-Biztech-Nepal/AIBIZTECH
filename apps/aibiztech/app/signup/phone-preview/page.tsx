import { notFound } from 'next/navigation';

// The dashboard preview inside a phone-sized window, to look at the phone version from a computer.
// It does not exist on the live site.
export default function PhonePreview() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', overflow: 'auto', background: '#d9ddea' }}>
      <iframe src="/signup/dashboard-preview" title="Phone dashboard" style={{ boxSizing: 'content-box', width: 390, height: 'min(844px, calc(100vh - 56px))', border: '10px solid #111318', borderRadius: 32, background: '#ffffff' }} />
    </div>
  );
}
