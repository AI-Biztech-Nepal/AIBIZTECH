// Tells the Finance app (served as static files under /finance) which Supabase project to use.
// Both values are public by design (the browser needs them), so they are safe to serve; keeping them here
// means the Finance build contains no keys and follows whatever the portal is set to.
export function GET() {
  const env = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  return new Response(`window.__ENV=${JSON.stringify(env)};`, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
