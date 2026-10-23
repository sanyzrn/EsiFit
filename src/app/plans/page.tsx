import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { PublicPageShell } from "@/components/layout/public-page-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { PlansView } from "@/features/store/plans-view";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "اشتراک و پلن‌ها",
  description: "پلن رایگان همیشه رایگان است. وی‌آی‌پی برای تحلیل عمیق‌تر، وی‌آی‌پی پلاس برای حداکثر امکانات ورزشکار. مربی‌گری نقش جداگانه دارد.",
};

export default async function PlansPage() {
  const session = await getSessionUser();
  if (session && session.role !== "member") redirect(session.role === "admin" ? "/admin" : "/coach");
  return (
    <PublicPageShell
      session={session}
      flags={resolveEnabledFlags()}
      title="اشتراک و پلن‌ها"
      description="شفاف و بدون قلاب — ارتقا برای تحلیل عمیق‌تر و convenience است، نه دسترسی به داده خودتان."
      backHref={session ? "/dashboard" : "/"}
      showFooter
    >
      <PlansView currentTier={session?.tier ?? null} />
    </PublicPageShell>
  );
}
