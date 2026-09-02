import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Strict typecheck is part of the production gate (was previously bypassed).
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  // Allows isolated production-build verification without clobbering dev .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
