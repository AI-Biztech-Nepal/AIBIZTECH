import type { NextConfig } from 'next';

// The fresh Attendance copy (services/attendance/admin-web) runs as its own Vercel project; the portal serves it under /attendance
// so it shares the portal's sign-in cookie. Leave unset until that project exists.
const ATTENDANCE_URL = (process.env.ATTENDANCE_URL ?? '').trim().replace(/\/$/, '');

// Stock Manager's server (services/stock/backend). The portal passes the app's /api calls on to it.
const STOCK_SERVER = (process.env.STOCK_SERVER ?? 'https://api.hamroauto.com.np').trim().replace(/\/$/, '');

const config: NextConfig = {
  // Default is 1 MB; the PAN photo (max 4 MB) is posted with the onboarding form
  // Stock Manager's photo and document uploads (up to 25 MB) pass through the portal to its server
  experimental: { serverActions: { bodySizeLimit: '5mb' }, proxyClientMaxBodySize: '30mb' },
  // no-store keeps the browser's back button from restoring a signed-in page or filled form after sign out
  headers: async () => [
    { source: '/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    // Finance's script and styles have a fingerprint in their name, so they can be kept
    { source: '/finance/_expo/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '/stock-app/static/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
  ],
  // Finance is a single-page app: any address under /finance that is not a real file opens its index.html
  // Old addresses of the apps now live under /app
  redirects: async () => [
    ...(ATTENDANCE_URL ? [] : [{ source: '/attendance/:path*', destination: '/app/attendance/:path*', permanent: false }]),
    // Stock Manager and its Marketing screens are the app in services/stock, shown inside the portal
    { source: '/stock', destination: '/app/stock', permanent: false },
    { source: '/stock/:path*', destination: '/app/stock/:path*', permanent: false },
    { source: '/marketing', destination: '/app/marketing', permanent: false },
    { source: '/marketing/crm', destination: '/app/marketing/marketing?tab=crm', permanent: false },
    { source: '/marketing/:path*', destination: '/app/marketing/:path*', permanent: false },
  ],
  rewrites: async () => ({
    beforeFiles: ATTENDANCE_URL
      ? [
          { source: '/attendance', destination: `${ATTENDANCE_URL}/attendance` },
          { source: '/attendance/:path*', destination: `${ATTENDANCE_URL}/attendance/:path*` },
        ]
      : [],
    afterFiles: [],
    // Used only when no portal page or real file matches
    fallback: [
      { source: '/finance/:path*', destination: '/finance/index.html' },
      { source: '/stock-app/:path*', destination: '/stock-app/index.html' },
      { source: '/brand/:path*', destination: '/stock-app/brand/:path*' },
      { source: '/api/:path*', destination: `${STOCK_SERVER}/api/:path*` },
    ],
  }),
};

export default config;
