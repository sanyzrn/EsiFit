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

export async function createDefaultPlanForUser(userId: string, availableEquipment?: Set<string> | null) {
  return createPlanFromTemplate(userId, "ppl", undefined, availableEquipment);
}

/** Progressive overload by week: baseline → build → peak → deload. */
export const PLAN_WEEKS = 4;

function progressiveSpec(base: PlannedSpec, weekNumber: number): PlannedSpec {
  const w = Math.min(Math.max(weekNumber, 1), PLAN_WEEKS);
  if (base.rest === 0 || (base.repsMin === 1 && base.repsMax === 1)) {
    // Rest / timed cardio — no set progression.
    return { ...base };
  }
  if (w === 1) return { ...base };
  if (w === 4) {
    // Deload: fewer sets, slightly easier RPE.
    return {
      ...base,
      sets: Math.max(2, base.sets - 1),
      rpe: Math.max(6, base.rpe - 1),
      note: [base.note, "هفته دی‌لود — کیفیت اجرا مهم‌تر از وزنه"].filter(Boolean).join(" · "),
    };
  }
  // Weeks 2–3: accumulate volume on working sets.
  const setBump = w === 3 && base.sets >= 3 ? 1 : 0;
  return {
    ...base,
    sets: base.sets + setBump,
    rpe: Math.min(9, base.rpe + (w === 3 ? 0.5 : 0)),
    note: [base.note, w === 2 ? "هفته ۲ — تثبیت فرم" : "هفته ۳ — اوج حجم"].filter(Boolean).join(" · "),
  };
}

/**
 * Create a plan for a user from a named template (onboarding default or coach assignment).
 * Generates the full multi-week block (PLAN_WEEKS). When `availableEquipment` is set,
 * exercises the user cannot perform are substituted by pattern/muscle affinity.
 */
export async function createPlanFromTemplate(
  userId: string,
  templateKey: PlanTemplateKey,
  startsOn?: string,
  availableEquipment?: Set<string> | null,
) {
  const tpl = TEMPLATES[templateKey] ?? TEMPLATES.ppl;
  const { loadExerciseCatalog, resolveExerciseForEquipment } = await import("@/lib/workout/catalog");
  const catalog = await loadExerciseCatalog();

  let equipment: Set<string> | null = availableEquipment ?? null;
  if (equipment === undefined) equipment = null;
  if (!availableEquipment) {
    const { getUserEquipmentSet } = await import("@/lib/workout/catalog");
    equipment = await getUserEquipmentSet(userId);
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
        weeks: PLAN_WEEKS,
        status: "active",
        startsOn: startsOn ?? new Date().toISOString().slice(0, 10),
        description: `${tpl.description} — بلوک ${PLAN_WEEKS} هفته‌ای (رشد → اوج → دی‌لود).`,
      },
    });

    const skipped = new Set<string>();
    const substituted = new Set<string>();

    for (let weekNumber = 1; weekNumber <= PLAN_WEEKS; weekNumber++) {
      for (let dayIdx = 0; dayIdx < tpl.days.length; dayIdx++) {
        const spec = tpl.days[dayIdx];
        const weekSuffix =
          weekNumber === 1
            ? " — هفته ۱"
            : weekNumber === 2
              ? " — هفته ۲"
              : weekNumber === 3
                ? " — هفته ۳"
                : " — هفته ۴ (دی‌لود)";
        const planDay = await tx.workoutPlanDay.create({
          data: {
            planId: plan.id,
            weekNumber,
            dayNumber: dayIdx + 1,
            name: `${spec.name}${weekSuffix}`,
            focusRegion: spec.focusRegion,
            isRestDay: Boolean(spec.isRest),
          },
        });

        let orderIndex = 0;
        for (const ex of spec.exercises) {
          const resolved = resolveExerciseForEquipment(catalog, ex.slug, equipment);
          if (!resolved) {
            skipped.add(ex.slug);
            continue;
          }
          if (resolved.slug !== ex.slug) substituted.add(`${ex.slug}→${resolved.slug}`);
          const progressive = progressiveSpec(ex, weekNumber);
          await tx.plannedExercise.create({
            data: {
              planDayId: planDay.id,
              exerciseId: resolved.id,
              orderIndex: orderIndex++,
              targetSets: progressive.sets,
              targetRepsMin: progressive.repsMin,
              targetRepsMax: progressive.repsMax,
              targetRpe: progressive.rpe,
              restSeconds: progressive.rest,
              note: resolved.slug !== ex.slug ? `${progressive.note ?? ""} · جایگزین: ${resolved.nameFa}`.trim() : (progressive.note ?? ""),
            },
          });
        }
      }
    }

    if (skipped.size > 0 || substituted.size > 0) {
      const bits: string[] = [];
      if (substituted.size > 0) bits.push(`جایگزینی بر اساس وسایل: ${[...substituted].slice(0, 6).join("، ")}`);
      if (skipped.size > 0) bits.push(`حذف‌شده (در دسترس نبود): ${[...skipped].join("، ")}`);
      await tx.workoutPlan.update({
        where: { id: plan.id },
        data: { description: `${plan.description}\n${bits.join(" | ")}` },
      });
    }

    return plan;
  });
}

/**
 * Pick today's plan day from the active multi-week plan.
 * Sequence: day-of-cycle from `startsOn`, week = floor(elapsed / cycleLen) + 1.
 */
export async function getTodayPlanDay(userId: string) {
  const plan = await db.workoutPlan.findFirst({
    where: { userId, status: "active" },
    include: { days: { include: { exercises: { include: { exercise: { include: { muscles: { include: { muscleGroup: true } } } } } }, plan: true } } },
  });
  if (!plan || plan.days.length === 0) return null;

  const weekOne = plan.days.filter((d) => d.weekNumber === 1).sort((a, b) => a.dayNumber - b.dayNumber);
  if (weekOne.length === 0) {
    const any = [...plan.days].sort((a, b) => a.dayNumber - b.dayNumber);
    return any[0];
  }

  const cycleLen = weekOne.length;
  const start = plan.startsOn;
  const today = new Date().toISOString().slice(0, 10);
  const elapsed = Math.max(0, Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000));
  const weekNumber = Math.min(plan.weeks || PLAN_WEEKS, Math.floor(elapsed / cycleLen) + 1);
  const dayNumber = (elapsed % cycleLen) + 1;

  return (
    plan.days.find((d) => d.weekNumber === weekNumber && d.dayNumber === dayNumber) ??
    plan.days.find((d) => d.weekNumber === 1 && d.dayNumber === dayNumber) ??
    weekOne[0]
  );
}
