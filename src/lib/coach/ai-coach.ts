/** Virtual coach identity: intentionally not a User account.
 * Planning is a separate engine, controlled by admin policy and athlete consent.
 */
export const AI_COACH_ID = "ai:esifit" as const;
export const AI_COACH_NAME = "برنامه‌ریز هوشمند اسی‌فیت";
export const AI_COACH = {
  id: AI_COACH_ID,
  displayName: AI_COACH_NAME,
  type: "ai" as const,
  status: "reserved" as const,
  description: "برنامه‌ریز مستقل از همپا؛ نیازمند اتصال فعال مدیر، رضایت ورزشکار و بررسی پیش‌نویس.",
};
export function isAiCoach(id: string | null): id is typeof AI_COACH_ID {
  return id === AI_COACH_ID;
}
