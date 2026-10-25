import "server-only";
import { db } from "@/lib/db";
import { DEFAULT_TIMEZONE, daysBetweenISO, todayISO } from "@/lib/dates/jalali";
import { formatWorkoutDayTitle, PLAN_TEMPLATE_LABELS } from "@/lib/workout/plan-titles";

/**
 * Starter plan templates — attached to every new account so the dashboard
 * always has "today's workout". Three training days + active rest, 4-week block.
 */

import { PLAN_PRESETS as TEMPLATES, type PlannedSpec, type PlanTemplateKey } from "@/lib/workout/plan-presets";
export type { PlanTemplateKey } from "@/lib/workout/plan-presets";
export const PLAN_TEMPLATE_FA = PLAN_TEMPLATE_LABELS;

export async function createDefaultPlanForUser(
  userId: string,
  availableEquipment?: Set<string> | null,
  timezone?: string,
) {
  return createPlanFromTemplate(userId, "ppl", undefined, availableEquipment, timezone);
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
  timezone: string = DEFAULT_TIMEZONE,
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

  return db.$transaction(async (tx) => {
    // Archive any previous active plan so "today" resolves to the new one. Done in
    // the same transaction: a failed build must never leave the user plan-less.
    await tx.workoutPlan.updateMany({
      where: { userId, status: "active" },
      data: { status: "archived" },
    });

    const plan = await tx.workoutPlan.create({
      data: {
        userId,
        name: tpl.name,
        goalType: "build_muscle",
        weeks: PLAN_WEEKS,
        status: "active",
        startsOn: startsOn ?? todayISO(timezone),
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
            name: formatWorkoutDayTitle(`${spec.name}${weekSuffix}`),
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
  }, { timeout: 30_000, maxWait: 10_000 });
}

/**
 * Pick today's plan day from the active multi-week plan.
 * Sequence: day-of-cycle from `startsOn`, week = floor(elapsed / cycleLen) + 1.
 */
export async function getTodayPlanDay(userId: string, timezone: string = DEFAULT_TIMEZONE) {
  const plan = await db.workoutPlan.findFirst({
    where: { userId, status: "active" },
    include: { days: { include: { exercises: { include: { exercise: { include: { muscles: { include: { muscleGroup: true } } } } } }, plan: true } } },
  });
  if (!plan || plan.days.length === 0) return null;

  const weekOne = plan.days.filter((d) => d.weekNumber === 1).sort((a, b) => a.dayNumber - b.dayNumber);
  if (weekOne.length === 0) {
    const any = [...plan.days].sort((a, b) => a.dayNumber - b.dayNumber);
    return { ...any[0], name: formatWorkoutDayTitle(any[0].name) };
  }

  const cycleLen = weekOne.length;
  const start = plan.startsOn;
  const elapsed = Math.max(0, daysBetweenISO(todayISO(timezone), start));
  const weekNumber = Math.min(plan.weeks || PLAN_WEEKS, Math.floor(elapsed / cycleLen) + 1);
  const dayNumber = (elapsed % cycleLen) + 1;

  const day = (
    plan.days.find((d) => d.weekNumber === weekNumber && d.dayNumber === dayNumber) ??
    plan.days.find((d) => d.weekNumber === 1 && d.dayNumber === dayNumber) ??
    weekOne[0]
  );
  return { ...day, name: formatWorkoutDayTitle(day.name) };
}
