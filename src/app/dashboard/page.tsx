import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";

export const dynamic = "force-dynamic";
export const metadata = { title: "داشبورد" };

export default async function DashboardPage() {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  // Admin accounts supervise coaches/athletes instead of tracking personal
  // workouts, hydration or nutrition; /admin is their canonical dashboard.
  if (session.role === "admin") redirect("/admin");
  if (!session.onboarded) redirect("/auth/onboarding");

  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <DashboardView />
    </AppShell>
  );
}
