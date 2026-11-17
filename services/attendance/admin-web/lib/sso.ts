import { createHmac, timingSafeEqual } from 'crypto';

// Verifies the short-lived token AIBIZTECH signs when someone presses "Open app".
// Server-only: SSO_SECRET must be the same value as on the AIBIZTECH project and never reach the browser.
export type SsoClaims = { sub: string; email: string; name: string; org_id: string; org_name: string; org_role: string; service: string; role: string };

export function verifySsoToken(token: string, secret: string): SsoClaims | null {
  const [h, p, sig] = token.split('.');
  if (!h || !p || !sig) return null;
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const c = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (c.iss !== 'aibiztech' || c.aud !== 'attendance' || typeof c.exp !== 'number' || c.exp < Date.now() / 1000) return null;
    return typeof c.email === 'string' && c.email ? (c as SsoClaims) : null;
  } catch {
    return null;
  }
}
