import { getSessionUser } from "@/lib/auth/session";
import { AppShell, PageHeader } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { PlansView } from "@/features/store/plans-view";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "اشتراک و پلن‌ها",
  description: "پلن رایگان همیشه رایگان است. وی‌آی‌پی برای تحلیل عمیق‌تر، وی‌آی‌پی پلاس برای حداکثر امکانات، حساب مربی برای حرفه‌ای‌ها.",
};

export default async function PlansPage() {
  const session = await getSessionUser();
  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <PageHeader title="اشتراک و پلن‌ها" description="شفاف و بدون قلاب — ارتقا برای convenience و تحلیل عمیق‌تر است، نه دسترسی به داده خودتان." />
      <PlansView currentTier={session?.tier ?? null} />
    </AppShell>
  );
}
