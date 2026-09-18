import "server-only";
import { db } from "@/lib/db";

/**
 * Starter plan templates — attached to every new account so the dashboard
 * always has "today's workout". Structure follows the classic push/pull/legs
 * split, 3 training days + active rest, 4-week block.
 */

type PlannedSpec = {
  slug: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  rpe: number;
  rest: number;
  note?: string;
};

type DaySpec = {
  name: string;
  focusRegion: string;
  isRest?: boolean;
  exercises: PlannedSpec[];
};

const PPL_TEMPLATE: DaySpec[] = [
  {
    name: "پُش و سینه — قدرت",
    focusRegion: "chest_back",
    exercises: [
      { slug: "barbell-bench-press", sets: 4, repsMin: 6, repsMax: 8, rpe: 8, rest: 150 },
      { slug: "barbell-row", sets: 4, repsMin: 6, repsMax: 8, rpe: 8, rest: 150 },
      { slug: "incline-dumbbell-press", sets: 3, repsMin: 8, repsMax: 12, rpe: 7.5, rest: 120 },
      { slug: "lat-pulldown", sets: 3, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "lateral-raise", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
      { slug: "triceps-pushdown", sets: 3, repsMin: 10, repsMax: 15, rpe: 8, rest: 60 },
    ],
  },
  {
    name: "پا — پایه",
    focusRegion: "legs",
    exercises: [
      { slug: "barbell-squat", sets: 4, repsMin: 6, repsMax: 8, rpe: 8, rest: 180 },
      { slug: "romanian-deadlift", sets: 3, repsMin: 8, repsMax: 10, rpe: 7.5, rest: 150 },
      { slug: "leg-press", sets: 3, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 120 },
      { slug: "leg-curl", sets: 3, repsMin: 10, repsMax: 15, rpe: 8, rest: 90 },
      { slug: "calf-raise", sets: 4, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
      { slug: "plank", sets: 3, repsMin: 1, repsMax: 1, rpe: 7, rest: 60, note: "هر ست ۴۵ ثانیه" },
    ],
  },
  {
    name: "استراحت فعال",
    focusRegion: "recovery",
    isRest: true,
    exercises: [
      { slug: "treadmill-run", sets: 1, repsMin: 1, repsMax: 1, rpe: 5, rest: 0, note: "۲۰ تا ۳۰ دقیقه پیاده‌روی تند یا دویدن سبک" },
    ],
  },
  {
    name: "سرشانه و بازو — حجم",
    focusRegion: "shoulders_arms",
    exercises: [
      { slug: "overhead-press", sets: 4, repsMin: 6, repsMax: 8, rpe: 8, rest: 150 },
      { slug: "seated-cable-row", sets: 3, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "dumbbell-shoulder-press", sets: 3, repsMin: 8, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "biceps-curl", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 75 },
      { slug: "hammer-curl", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 75 },
      { slug: "face-pull", sets: 3, repsMin: 15, repsMax: 20, rpe: 7, rest: 60 },
    ],
  },
];

/** Coach assignment templates (roadmap: coach plan tools). */
export type PlanTemplateKey = "ppl" | "upper_lower";

export const PLAN_TEMPLATE_FA: Record<PlanTemplateKey, string> = {
  ppl: "پوش/پول/پا — ۳ روز",
  upper_lower: "بالاتنه/پایین‌تنه — ۴ روز",
};

const UPPER_LOWER_TEMPLATE: DaySpec[] = [
  {
    name: "بالاتنه — قدرت",
    focusRegion: "chest_back",
    exercises: [
      { slug: "barbell-bench-press", sets: 4, repsMin: 5, repsMax: 8, rpe: 8, rest: 150 },
      { slug: "barbell-row", sets: 4, repsMin: 6, repsMax: 8, rpe: 8, rest: 150 },
      { slug: "overhead-press", sets: 3, repsMin: 8, repsMax: 10, rpe: 7.5, rest: 120 },
      { slug: "lat-pulldown", sets: 3, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "biceps-curl", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 75 },
      { slug: "triceps-pushdown", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 75 },
    ],
  },
  {
    name: "پایین‌تنه — قدرت",
    focusRegion: "legs",
    exercises: [
      { slug: "barbell-squat", sets: 4, repsMin: 5, repsMax: 8, rpe: 8, rest: 180 },
      { slug: "leg-press", sets: 3, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 120 },
      { slug: "romanian-deadlift", sets: 3, repsMin: 8, repsMax: 10, rpe: 7.5, rest: 150 },
      { slug: "leg-curl", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 90 },
      { slug: "calf-raise", sets: 4, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
    ],
  },
  {
    name: "استراحت فعال",
    focusRegion: "recovery",
    isRest: true,
    exercises: [
      { slug: "treadmill-run", sets: 1, repsMin: 1, repsMax: 1, rpe: 5, rest: 0, note: "۲۰ دقیقه پیاده‌روی تند" },
    ],
  },
  {
    name: "بالاتنه — حجم",
    focusRegion: "chest_back",
    exercises: [
      { slug: "incline-dumbbell-press", sets: 4, repsMin: 8, repsMax: 12, rpe: 8, rest: 105 },
      { slug: "seated-cable-row", sets: 4, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "dumbbell-shoulder-press", sets: 3, repsMin: 8, repsMax: 12, rpe: 7.5, rest: 105 },
      { slug: "face-pull", sets: 3, repsMin: 15, repsMax: 20, rpe: 7, rest: 60 },
      { slug: "hammer-curl", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 75 },
      { slug: "lateral-raise", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
    ],
  },
  {
    name: "پایین‌تنه — حجم",
    focusRegion: "legs",
    exercises: [
      { slug: "leg-press", sets: 4, repsMin: 10, repsMax: 12, rpe: 8, rest: 120 },
      { slug: "hip-thrust", sets: 3, repsMin: 10, repsMax: 12, rpe: 8, rest: 105 },
      { slug: "leg-extension", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 75 },
      { slug: "leg-curl", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 75 },
      { slug: "calf-raise", sets: 4, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
      { slug: "plank", sets: 3, repsMin: 1, repsMax: 1, rpe: 7, rest: 60, note: "هر ست ۴۵ ثانیه" },
    ],
  },
  {
    name: "استراحت",
    focusRegion: "recovery",
    isRest: true,
    exercises: [],
  },
  {
    name: "بالاتنه — تکراربازی",
    focusRegion: "chest_back",
    exercises: [
      { slug: "push-up", sets: 4, repsMin: 12, repsMax: 20, rpe: 8, rest: 75 },
      { slug: "dumbbell-row", sets: 4, repsMin: 10, repsMax: 12, rpe: 7.5, rest: 90 },
      { slug: "pull-up", sets: 3, repsMin: 5, repsMax: 10, rpe: 8, rest: 120 },
      { slug: "lateral-raise", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
      { slug: "biceps-curl", sets: 3, repsMin: 12, repsMax: 15, rpe: 8, rest: 60 },
    ],
  },
];

const TEMPLATES: Record<PlanTemplateKey, { name: string; description: string; days: DaySpec[] }> = {
  ppl: {
    name: "برنامه شروع اسی‌فیت — پوش/پول/پا",
    description: "برنامه سه‌روزه پایه با یک روز استراحت فعال؛ برای هفته‌های اول و آشنایی با فرم حرکات.",
    days: PPL_TEMPLATE,
  },
  upper_lower: {
    name: "بالاتنه/پایین‌تنه — ۴ روز",
    description: "چهار روز تمرین با تفکیک بالاتنه/پایین‌تنه؛ مناسب هدف هیپرتروفی با پیوستگی بالا.",
    days: UPPER_LOWER_TEMPLATE,
  },
};

export async function createDefaultPlanForUser(userId: string) {
  return createPlanFromTemplate(userId, "ppl");
}

/** Create a plan for a user from a named template (onboarding default or coach assignment). */
export async function createPlanFromTemplate(userId: string, templateKey: PlanTemplateKey, startsOn?: string) {
  const tpl = TEMPLATES[templateKey] ?? TEMPLATES.ppl;
  const exercises = await db.exercise.findMany({
    where: { slug: { in: tpl.days.flatMap((d) => d.exercises.map((x) => x.slug)) } },
    select: { id: true, slug: true },
  });
  const bySlug = new Map(exercises.map((x) => [x.slug, x.id]));
  const missing = tpl.days.flatMap((d) => d.exercises.filter((x) => !bySlug.has(x.slug)).map((x) => x.slug));
  if (missing.length > 0) {
    // Catalog gaps must not abort provisioning — surface them on the plan note.
    console.warn("[plan-template] missing exercises skipped:", missing.join(", "));
  }

  // Archive any previous active plan so "today" resolves to the new one.
  await db.workoutPlan.updateMany({
    where: { userId, status: "active" },
    data: { status: "archived" },
  });

  return db.$transaction(async (tx) => {
    const plan = await tx.workoutPlan.create({
      data: {
        userId,
        name: tpl.name,
        goalType: "build_muscle",
        weeks: 4,
        status: "active",
        startsOn: startsOn ?? new Date().toISOString().slice(0, 10),
        description:
          missing.length > 0
            ? `${tpl.description}\n(برخی حرکات در کتابخانه موجود نبود و حذف شدند)`
            : tpl.description,
      },
    });

    for (let dayIdx = 0; dayIdx < tpl.days.length; dayIdx++) {
      const spec = tpl.days[dayIdx];
      const planDay = await tx.workoutPlanDay.create({
        data: {
          planId: plan.id,
          weekNumber: 1,
          dayNumber: dayIdx + 1,
          name: spec.name,
          focusRegion: spec.focusRegion,
          isRestDay: Boolean(spec.isRest),
        },
      });
      for (let exIdx = 0; exIdx < spec.exercises.length; exIdx++) {
        const ex = spec.exercises[exIdx];
        const exerciseId = bySlug.get(ex.slug);
        if (!exerciseId) continue;
        await tx.plannedExercise.create({
          data: {
            planDayId: planDay.id,
            exerciseId,
            orderIndex: exIdx,
            targetSets: ex.sets,
            targetRepsMin: ex.repsMin,
            targetRepsMax: ex.repsMax,
            targetRpe: ex.rpe,
            restSeconds: ex.rest,
            note: ex.note ?? "",
          },
        });
      }
    }

    return plan;
  });
}

/** Pick today's plan day deterministically from user's active plan. */
export async function getTodayPlanDay(userId: string) {
  const plan = await db.workoutPlan.findFirst({
    where: { userId, status: "active" },
    include: { days: { include: { exercises: { include: { exercise: { include: { muscles: { include: { muscleGroup: true } } } } } }, plan: true } } },
  });
  if (!plan || plan.days.length === 0) return null;

  const trainingDays = plan.days.filter((d) => !d.isRestDay);
  if (trainingDays.length === 0) return plan.days[0];

  // Sequence from plan start date (not day-of-year + user hash) so a coach
  // prescription starting tomorrow actually rotates day1 → day2 → …
  const ordered = [...trainingDays].sort((a, b) => a.dayNumber - b.dayNumber);
  const start = plan.startsOn;
  const today = new Date().toISOString().slice(0, 10);
  const elapsed = Math.max(0, Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000));
  return ordered[elapsed % ordered.length];
}
