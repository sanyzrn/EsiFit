import { getSessionUser } from "@/lib/auth/session";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { StoreView } from "@/features/store/store-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "فروشگاه" };

/**
 * Catalog is browsable signed-out; checkout still requires auth (StoreView CTA).
 * Public navbar links here — never hard-redirect anonymous visitors to login.
 */
export default async function StorePage() {
  const session = await getSessionUser();
  return (
    <PublicPageShell
      session={session}
      flags={resolveEnabledFlags()}
      backHref={session ? "/dashboard" : "/"}
      showFooter={!session}
    >
      <StoreView signedIn={Boolean(session)} />
    </PublicPageShell>
  );
}
