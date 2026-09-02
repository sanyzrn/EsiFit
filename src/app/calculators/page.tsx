import { getSessionUser } from "@/lib/auth/session";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { Footer } from "@/components/layout/footer";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { CalculatorsHub } from "@/features/calculators/calculators-hub";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ماشین‌حساب‌های تناسب اندام",
  description: "هشت ماشین‌حساب تخصصی با فرمول‌های استاندارد: BMI، TDEE، ماکرو، ۱RM و بیشتر — نتیجه فوری بدون ثبت‌نام.",
};

/**
 * Public calculators — the useful core result is anonymous (00_README rule).
 * Members additionally get the app shell + result saving.
 */
export default async function CalculatorsPage() {
  const session = await getSessionUser();

  if (session) {
    return (
      <AppShell session={session} flags={resolveEnabledFlags()}>
        <PageHeader title="ماشین‌حساب‌ها" description="نتیجه فوری با فرمول‌های استاندارد علمی — بدون نیاز به ثبت‌نام." />
        <CalculatorsHub />
      </AppShell>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <PublicNavbar />
      <main className="flex-1">
        <PageHeader
          title="ماشین‌حساب‌ها"
          description="نتیجه فوری با فرمول‌های استاندارد علمی — بدون نیاز به ثبت‌نام. برای ذخیره تاریخچه وارد شوید."
        />
        <CalculatorsHub />
      </main>
      <Footer />
    </div>
  );
}
