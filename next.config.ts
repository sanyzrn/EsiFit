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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
