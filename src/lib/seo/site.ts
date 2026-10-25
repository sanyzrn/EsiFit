import type { Metadata } from "next";
/** Environment-owned origin, never inferred from an untrusted request Host. */
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  const candidate = env.NEXT_PUBLIC_SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:3000");
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid public site origin");
  return url.origin;
}
export const SOCIAL_IMAGE = { url: "/og/esifit.png", width: 1200, height: 630, alt: "اسی‌فیت — هر روز قوی‌تر از دیروز" };
export function publicMetadata(path: string, title: string, description?: string): Metadata {
  return { title, description, alternates: { canonical: path },
    openGraph: { type: "website", title, description, url: path, siteName: "اسی‌فیت", locale: "fa_IR", images: [SOCIAL_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [SOCIAL_IMAGE.url] } };
}
