import type { NextConfig } from 'next';

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
  // /attendance and /stock are portal addresses for the apps that run on the VPS. Until an app is set up to run under the
  // portal address (ATTENDANCE_URL set = the portal serves it right here), the address sends people to the live app.
  redirects: async () => [
    ...(process.env.ATTENDANCE_URL ? [] : [{ source: '/attendance/:path*', destination: `${process.env.ATTENDANCE_LIVE_URL ?? 'https://attendance-nepal.com'}/:path*`, permanent: false }]),
    { source: '/stock/:path*', destination: `${process.env.STOCK_LIVE_URL ?? 'https://stock.hamroauto.com.np'}/:path*`, permanent: false },
  ],
  rewrites: async () => ({
    beforeFiles: [],
    // Attendance is its own app (a separate Vercel project) that the portal serves under /attendance, so the sign-in cookie is shared
    afterFiles: process.env.ATTENDANCE_URL ? [{ source: '/attendance/:path*', destination: `${process.env.ATTENDANCE_URL.replace(/\/$/, '')}/attendance/:path*` }] : [],
    fallback: [{ source: '/finance/:path*', destination: '/finance/index.html' }],
  }),
};

export default config;
