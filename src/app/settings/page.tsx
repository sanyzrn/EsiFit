import { redirect } from "next/navigation";
import { getSessionUser, listSessions } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { SettingsView } from "@/features/dashboard/settings-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "تنظیمات" };

export default async function SettingsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  const sessions = await listSessions(session.id);
  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <SettingsView
        session={session}
        devices={sessions.map((s) => ({
          id: s.id,
          deviceLabel: s.deviceLabel,
          lastSeenAt: s.lastSeenAt.toISOString(),
        }))}
      />
    </AppShell>
  );
}
