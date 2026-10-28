import type { NextConfig } from 'next';

const config: NextConfig = {
  // Default is 1 MB; the PAN photo (max 4 MB) is posted with the onboarding form
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  // no-store keeps the browser's back button from restoring a signed-in page or filled form after sign out
  headers: async () => [{ source: '/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] }],
};

export default config;
