import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  output: process.env.NODE_ENV === "production" && process.env.GITHUB_ACTIONS ? "export" : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Headers are not supported in static export, but keep for development
  ...(process.env.GITHUB_ACTIONS ? {} : {
    headers() {
      // Required by FHEVM 
      return Promise.resolve([
        {
          source: '/',
          headers: [
            {
              key: 'Cross-Origin-Opener-Policy',
              value: 'same-origin',
            },
            {
              key: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp',
            },
          ],
        },
      ]);
    }
  }),
};

export default nextConfig;

