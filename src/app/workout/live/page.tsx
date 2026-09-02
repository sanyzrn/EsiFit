import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { WorkoutLiveGate } from "@/features/workouts/workout-live-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "تمرین زنده" };

export default async function LiveWorkoutPage() {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");

  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <WorkoutLiveGate />
    </AppShell>
  );
}
