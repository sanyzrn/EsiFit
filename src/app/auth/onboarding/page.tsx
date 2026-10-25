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
  return (
    <AppShell session={session} variant="auth">
      <div className="min-h-dvh flex flex-col gap-4 items-center justify-center px-4 py-10">
        <ThemeToggle />
        <OnboardingFlow displayName={session.displayName} returnTo={next} />
      </div>
    </AppShell>
  );
}
