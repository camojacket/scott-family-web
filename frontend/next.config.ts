import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Re-enable ESLint during builds to catch issues early.
  // If you have legacy lint issues, fix them rather than ignoring.
  // eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    '@mui/material',
    '@mui/system',
    '@mui/icons-material',
    '@mui/lab',
    '@mui/base',
    '@mui/utils',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'scottfamilyweb-cdn-fd-frfedzbjfgfvhce7.z03.azurefd.net',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
