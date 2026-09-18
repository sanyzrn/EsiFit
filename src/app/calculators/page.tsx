import { getSessionUser } from "@/lib/auth/session";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { CalculatorsHub } from "@/features/calculators/calculators-hub";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ماشین‌حساب‌های تناسب اندام",
  description: "هشت ماشین‌حساب تخصصی با فرمول‌های استاندارد: BMI، TDEE، ماکرو، ۱RM و بیشتر — نتیجه فوری بدون ثبت‌نام.",
};

/**
 * Public calculators — core result is anonymous. Shared PublicPageShell
 * reserves top padding under the fixed navbar for anonymous visitors.
 */
export default async function CalculatorsPage() {
  const session = await getSessionUser();
  return (
    <PublicPageShell
      session={session}
      flags={resolveEnabledFlags()}
      title="ماشین‌حساب‌ها"
      description={
        session
          ? "نتیجه فوری با فرمول‌های استاندارد علمی — بدون نیاز به ثبت‌نام."
          : "نتیجه فوری با فرمول‌های استاندارد علمی. برای ذخیره تاریخچه وارد شوید."
      }
      backHref={session ? "/dashboard" : undefined}
      showFooter
    >
      <CalculatorsHub />
    </PublicPageShell>
  );
}
