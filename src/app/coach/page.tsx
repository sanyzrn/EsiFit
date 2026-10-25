import { requireRolePage } from "@/lib/auth/page-guard";
import { AppShell } from "@/components/layout/app-shell";
import { CoachWorkspaceView } from "@/features/coach/coach-workspace-view";
import { getCoachRoster } from "@/lib/coach/data";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";

export const dynamic = "force-dynamic";
export const metadata = { title: "ورزشکاران من — مربی" };

export default async function CoachPage() {
  const session = await requireRolePage("/coach", "coach");

  // Admins supervise every linked roster (read-only console entry point).
  const roster = await getCoachRoster(session.id);
  const pendingAssignments = roster.filter(athlete => athlete.planName).length;

  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <CoachWorkspaceView
        roster={roster}
        activePlans={pendingAssignments}
        coachName={session.displayName}
      />
    </AppShell>
  );
}
