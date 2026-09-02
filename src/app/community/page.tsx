import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { CommunityView } from "@/features/community/community-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "انجمن" };

export default async function CommunityPage() {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <CommunityView signedIn />
    </AppShell>
  );
}
