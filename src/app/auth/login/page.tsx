import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { AuthCard } from "@/components/features/auth-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "ورود به اسی‌فیت" };

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session) redirect("/dashboard");
  return (
    <AppShell session={null}>
      <div className="min-h-dvh flex items-center justify-center px-4 py-10">
        <AuthCard />
      </div>
    </AppShell>
  );
}
