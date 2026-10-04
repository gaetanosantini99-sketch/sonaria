import type { NextConfig } from 'next';

const noIndex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      { source: '/e/:path*', headers: noIndex },
      { source: '/c/:path*', headers: noIndex },
      { source: '/v/:path*', headers: noIndex },
      { source: '/admin/:path*', headers: noIndex },
    ];
  },
};

export default nextConfig;
