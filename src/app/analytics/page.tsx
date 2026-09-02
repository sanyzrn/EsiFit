import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { AnalyticsView } from "@/features/analytics/analytics-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "تحلیل پیشرفت" };

export default async function AnalyticsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <AnalyticsView />
    </AppShell>
  );
}
