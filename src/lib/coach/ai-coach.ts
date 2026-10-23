/** Virtual coach identity: intentionally not a User account.
 * AI coaching is disabled until a separate safety + product rollout.
 */
export const AI_COACH_ID = "ai:esifit" as const;
export const AI_COACH_NAME = "مربی هوشمند اسی‌فیت";
export const AI_COACH = {
  id: AI_COACH_ID,
  displayName: AI_COACH_NAME,
  type: "ai" as const,
  status: "reserved" as const,
  description: "زیرساخت آماده است؛ تولید برنامه هوشمند هنوز فعال نشده.",
};
export function isAiCoach(id: string | null): id is typeof AI_COACH_ID {
  return id === AI_COACH_ID;
}
