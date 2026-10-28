// Where to send the user after sign-in. Only portal paths and hosts under the shared cookie
// domain are allowed, so ?next= cannot bounce users to another site.
export function safeNext(next: string | null | undefined, cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN): string {
  if (!next) return '/';
  if (next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next;

  let url: URL;
  try {
    url = new URL(next);
  } catch {
    return '/';
  }
  const parent = cookieDomain?.replace(/^\./, '').toLowerCase();
  if (parent) {
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (host === parent || host.endsWith(`.${parent}`)) ? url.href : '/';
  }
  // Local development: services run on localhost ports
  return url.hostname === 'localhost' ? url.href : '/';
}
