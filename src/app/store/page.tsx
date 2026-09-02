import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { StoreView } from "@/features/store/store-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "فروشگاه" };

export default async function StorePage() {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <StoreView signedIn />
    </AppShell>
  );
}
