import { getCatalog } from "@/lib/commerce/catalog";
import type { Catalog } from "@/lib/commerce/catalog-types";
import { isMemberTier } from "@/lib/auth/access-policy";
import { publicMetadata } from "@/lib/seo/site";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { StoreView } from "@/features/store/store-view";

export const dynamic = "force-dynamic";
export const metadata = publicMetadata("/store", "فروشگاه اسی‌فیت", "کاتالوگ تجهیزات ورزشی؛ قیمت و موجودی فعلی، با خرید آزمایشی پس از ورود.");

/**
 * Catalog is browsable signed-out; checkout still requires auth (StoreView CTA).
 * Public navbar links here — never hard-redirect anonymous visitors to login.
 */
export default async function StorePage() {
  const session = await getSessionUser();
  if (session && session.role !== "member") redirect(session.role === "admin" ? "/admin" : "/coach");
  let catalog: Catalog | null = null;
  try { catalog = await getCatalog(session && isMemberTier(session.tier) ? session.tier : "free"); } catch { /* Recoverable catalog error is shown by the client. */ }
  return (
    <PublicPageShell
      session={session}
      flags={resolveEnabledFlags()}
      backHref={session ? "/dashboard" : "/"}
      showFooter={!session}
    >
      <StoreView signedIn={Boolean(session)} initialCatalog={catalog} />
    </PublicPageShell>
  );
}
