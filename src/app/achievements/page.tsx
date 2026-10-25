import { loginPath } from "@/lib/auth/return-path";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { AchievementsView } from "@/features/gamification/achievements-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "دستاوردها" };

export default async function AchievementsPage() {
  const session = await getSessionUser();
  if (!session) redirect(loginPath("/achievements"));
  if (session.role !== "member") redirect(session.role === "admin" ? "/admin" : "/coach");
  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <AchievementsView />
    </AppShell>
  );
}
