import type { NextConfig } from 'next';

// The fresh Attendance copy (services/attendance/admin-web) runs as its own Vercel project; the portal serves it under /attendance
// so it shares the portal's sign-in cookie. Leave unset until that project exists.
const ATTENDANCE_URL = (process.env.ATTENDANCE_URL ?? '').trim().replace(/\/$/, '');

const config: NextConfig = {
  // Default is 1 MB; the PAN photo (max 4 MB) is posted with the onboarding form
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  // no-store keeps the browser's back button from restoring a signed-in page or filled form after sign out
  headers: async () => [
    { source: '/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    // Finance's script and styles have a fingerprint in their name, so they can be kept
    { source: '/finance/_expo/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
  ],
  // Finance is a single-page app: any address under /finance that is not a real file opens its index.html
  // Old addresses of the apps now live under /app
  redirects: async () => [
    ...(ATTENDANCE_URL ? [] : [{ source: '/attendance/:path*', destination: '/app/attendance/:path*', permanent: false }]),
  ],
  rewrites: async () => ({
    beforeFiles: ATTENDANCE_URL
      ? [
          { source: '/attendance', destination: `${ATTENDANCE_URL}/attendance` },
          { source: '/attendance/:path*', destination: `${ATTENDANCE_URL}/attendance/:path*` },
        ]
      : [],
    afterFiles: [],
    fallback: [{ source: '/finance/:path*', destination: '/finance/index.html' }],
  }),
};

export default config;
