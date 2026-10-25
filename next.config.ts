import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Strict typecheck is part of the production gate (was previously bypassed).
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-*" }],
  },
  // Allows isolated production-build verification without clobbering dev .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Content-Security-Policy", value: [
            "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'self'",
            "form-action 'self'", "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
            "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https://images.unsplash.com https://exercise-dataset.com",
            "font-src 'self' data:", "connect-src 'self'" + (process.env.NODE_ENV === "development" ? " ws: wss:" : ""),
            "media-src 'self' blob:", "worker-src 'self' blob:", "manifest-src 'self'",
          ].join("; ") },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
