import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { AuthCard } from "@/components/features/auth-card";
import { AuthShowcase } from "@/components/features/auth-showcase";

export const dynamic = "force-dynamic";
export const metadata = { title: "ورود به اسی‌فیت" };

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session) redirect("/dashboard");
  return (
    <AppShell session={null} variant="auth">
      <div className="grid min-h-dvh lg:grid-cols-2">
        <AuthShowcase />
        <div className="relative flex flex-col items-center justify-center gap-6 px-4 py-10">
          <AuthCard />
          <a href="/" className="text-sm text-esi-text-muted hover:text-esi-text-primary transition-colors min-h-11 inline-flex items-center">
            بازگشت به صفحه اصلی
          </a>
        </div>
      </div>
    </AppShell>
  );
}
