import { z } from "zod";
export const coachExerciseInput = z.object({
  slug: z.string().min(1).max(100), sets: z.number().int().min(1).max(6),
  repsMin: z.number().int().min(1).max(30), repsMax: z.number().int().min(1).max(30),
  rpe: z.number().min(5).max(9.5), rest: z.number().int().min(0).max(300), note: z.string().max(300).optional(),
}).strict().refine(x => x.repsMax >= x.repsMin, "حد بالای تکرار از حد پایین کمتر است.");
export const coachDayInput = z.object({
  name: z.string().trim().min(1).max(80), focusRegion: z.string().max(40), isRest: z.boolean().optional(),
  exercises: z.array(coachExerciseInput).max(12),
}).strict().refine(x => x.isRest ? x.exercises.length === 0 : x.exercises.length > 0, "روز استراحت باید خالی و روز تمرین باید دارای حرکت باشد.")
  .refine(x => new Set(x.exercises.map(e => e.slug)).size === x.exercises.length, "حرکت تکراری در یک روز مجاز نیست.");
export const coachProgramInput = z.object({
  athleteId: z.string().min(1), sourcePlanId: z.string().nullable(),
  name: z.string().trim().min(3).max(100), description: z.string().trim().max(1000),
  goalType: z.enum(["build_muscle", "lose_weight", "endurance", "health", "recomp"]),
  weeks: z.number().int().min(1).max(8), days: z.array(coachDayInput).length(7),
}).strict().refine(x => x.days.some(d => !d.isRest) && x.days.some(d => d.isRest), "حداقل یک روز تمرین و یک روز استراحت لازم است.");
export type CoachProgramInput = z.infer<typeof coachProgramInput>;
export type CoachProgramDraft = Omit<CoachProgramInput, "athleteId" | "sourcePlanId">;
export type CoachExerciseOption = { id: string; slug: string; nameFa: string; equipment: string };
export type CoachActivePlan = CoachProgramDraft & { id: string; startsOn: string };
