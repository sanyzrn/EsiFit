import { loginPath } from "@/lib/auth/return-path";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { WorkoutLiveGate } from "@/features/workouts/workout-live-gate";

export const dynamic = "force-dynamic";
export const metadata = { title: "تمرین زنده" };

export default async function LiveWorkoutPage({ searchParams }: { searchParams: Promise<{ session?: string; planDay?: string }> }) {
  const params = await searchParams; const query = new URLSearchParams();
  if (typeof params.session === "string") query.set("session", params.session);
  if (typeof params.planDay === "string") query.set("planDay", params.planDay);
  const session = await getSessionUser();
  if (!session) redirect(loginPath(`/workout/live${query.size ? `?${query}` : ""}`));
  if (session.role !== "member") redirect(session.role === "admin" ? "/admin" : "/coach");

  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <WorkoutLiveGate />
    </AppShell>
  );
}
