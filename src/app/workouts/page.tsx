import { loginPath } from "@/lib/auth/return-path";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { db } from "@/lib/db";
import { getTodayPlanDay } from "@/features/workouts/data/plan-templates";
import { WorkoutsView } from "@/features/workouts/workouts-view";
import { formatWorkoutPlanTitle } from "@/lib/workout/plan-titles";

export const dynamic = "force-dynamic";
export const metadata = { title: "تمرین" };

export default async function WorkoutsPage() {
  const session = await getSessionUser();
  if (!session) redirect(loginPath("/workouts"));
  if (session.role !== "member") redirect(session.role === "admin" ? "/admin" : "/coach");

  const [planDay, exercises, activePlan] = await Promise.all([
    getTodayPlanDay(session.id, session.timezone),
    db.exercise.findMany({
      include: { muscles: { include: { muscleGroup: true } } },
      orderBy: { nameFa: "asc" },
    }),
    db.workoutPlan.findFirst({ where: { userId: session.id, status: "active" } }),
  ]);

  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <WorkoutsView
        planDay={
          planDay
            ? {
                id: planDay.id,
                name: planDay.name,
                isRest: planDay.isRestDay,
                exercises: planDay.exercises.map((e) => ({
                  name: e.exercise.nameFa,
                  sets: e.targetSets,
                  repsMin: e.targetRepsMin,
                  repsMax: e.targetRepsMax,
                  rest: e.restSeconds,
                  note: e.note,
                  muscles: e.exercise.muscles.filter((m) => m.role === "primary").map((m) => m.muscleGroup.nameFa),
                })),
              }
            : null
        }
        activePlanName={activePlan ? formatWorkoutPlanTitle(activePlan.name) : null}
        exercises={exercises.map((ex) => ({
          id: ex.id,
          slug: ex.slug,
          name: ex.nameFa,
          equipment: ex.equipment,
          pattern: ex.movementPattern,
          difficulty: ex.difficulty,
          instructions: ex.instructionsFa,
          muscles: ex.muscles.map((m) => ({
            name: m.muscleGroup.nameFa,
            slug: m.muscleGroup.slug,
            role: m.role,
            intensity: m.intensity,
          })),
        }))}
      />
    </AppShell>
  );
}
