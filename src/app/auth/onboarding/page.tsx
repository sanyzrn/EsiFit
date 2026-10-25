import { db } from "@/lib/db";
import { safeReturnPath, loginPath } from "@/lib/auth/return-path";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingFlow } from "@/components/features/onboarding-flow";

export const dynamic = "force-dynamic";
export const metadata = { title: "تکمیل پروفایل" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeReturnPath((await searchParams).next);
  const session = await getSessionUser();
  if (!session) redirect(loginPath(next));
  if (session.role !== "member") redirect(next ?? (session.role === "admin" ? "/admin" : "/coach"));
  const [profile,measurement]=await Promise.all([db.userProfile.findUnique({where:{userId:session.id}}),db.bodyMeasurement.findFirst({where:{userId:session.id,weightKg:{not:null}},orderBy:{measuredOn:"desc"}})]);
  return (
    <AppShell session={session} variant="auth">
      <div className="min-h-dvh flex flex-col gap-4 items-center justify-center px-4 py-10">
        <ThemeToggle />
        <OnboardingFlow displayName={session.displayName} returnTo={next} initialProfile={profile?.onboardedAt?{birthYear:profile.birthYear,sexAtBirth:profile.sexAtBirth,heightCm:profile.heightCm,weightKg:measurement?.weightKg??null,primaryGoal:profile.primaryGoal,experienceLevel:profile.experienceLevel,activityLevel:profile.activityLevel,availableEquipment:profile.availableEquipment,weeklyWorkoutTarget:profile.weeklyWorkoutTarget,workoutMinutes:profile.workoutMinutes,medicalReviewRequired:profile.medicalReviewRequired,healthNotes:profile.healthNotes}:undefined} />
      </div>
    </AppShell>
  );
}
