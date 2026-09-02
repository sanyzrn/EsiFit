import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingFlow } from "@/components/features/onboarding-flow";

export const dynamic = "force-dynamic";
export const metadata = { title: "تکمیل پروفایل" };

export default async function OnboardingPage() {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  return (
    <AppShell session={session}>
      <div className="min-h-dvh flex items-center justify-center px-4 py-10">
        <OnboardingFlow displayName={session.displayName} />
      </div>
    </AppShell>
  );
}
