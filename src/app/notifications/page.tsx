import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { NotificationsView } from "@/features/dashboard/notifications-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "اعلان‌ها" };

export default async function NotificationsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <NotificationsView />
    </AppShell>
  );
}
