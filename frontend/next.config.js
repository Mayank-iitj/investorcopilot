/** @type {import('next').NextConfig} */
const path = require('path');
const serverApiUrl = process.env.NEXT_SERVER_API_URL || 'http://localhost:8000';

const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${serverApiUrl}/api/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${serverApiUrl}/ws/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
