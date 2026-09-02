import "server-only";
import { db } from "@/lib/db";
import { createDefaultPlanForUser } from "@/features/workouts/data/plan-templates";

/**
 * First-verification provisioning: creates the account skeleton.
 * Display name is intentionally generic until onboarding collects the real one.
 * A starter plan is attached so the dashboard has today's workout immediately.
 */
export async function createUserWithSeedHistory(phone: string) {
  const user = await db.user.create({
    data: {
      phone,
      displayName: "ورزشکار اسی‌فیت",
    },
  });

  await db.userProfile.create({
    data: { userId: user.id },
  });

  await createDefaultPlanForUser(user.id);

  return db.user.findUniqueOrThrow({ where: { id: user.id } });
}
