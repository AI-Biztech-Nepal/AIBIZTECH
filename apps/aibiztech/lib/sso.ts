import { createHmac, randomUUID } from 'crypto';

// Short-lived signed token (HS256 JWT) that tells an app who just signed in to AIBIZTECH.
// The app checks it with the same SSO_SECRET, so the secret must never reach a browser.
const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');

export type SsoClaims = { sub: string; email: string; name: string; org_id: string; org_name: string; org_role: string; service: string; role: string };

export function signSsoToken(claims: SsoClaims, secret: string, ttlSeconds = 60) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ ...claims, iss: 'aibiztech', aud: claims.service, iat: now, exp: now + ttlSeconds, jti: randomUUID() })}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
