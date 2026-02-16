import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Re-enable ESLint during builds to catch issues early.
  // If you have legacy lint issues, fix them rather than ignoring.
  // eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: [
    'isomorphic-dompurify',
    'jsdom',
  ],
  transpilePackages: [
    '@mui/material',
    '@mui/system',
    '@mui/icons-material',
    '@mui/lab',
    '@mui/base',
    '@mui/utils',
  ],
  images: {
    // Azure Front Door already serves optimised images; skip the Next.js
    // image-optimisation proxy entirely so every <Image> renders a plain
    // <img> pointing straight at the CDN.  This eliminates the dev-server
    // concurrency bottleneck and removes the proxy as a failure point.
    unoptimized: true,
  },
};

export default nextConfig;
