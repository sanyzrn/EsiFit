import type { MetadataRoute } from "next";

/**
 * Robots policy. Generated (not a static file) so the Sitemap line always
 * carries the deployment's real origin.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated surfaces: nothing to index, and crawling them only
        // burns budget on pages that redirect to the login screen.
        disallow: [
          "/api/",
          "/dashboard",
          "/workout/",
          "/workouts",
          "/nutrition",
          "/analytics",
          "/achievements",
          "/ai",
          "/settings",
          "/notifications",
          "/admin",
          "/coach",
          // Login-walled for anonymous visitors — nothing for a crawler to index.
          "/store",
          "/community",
          "/auth/onboarding",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
