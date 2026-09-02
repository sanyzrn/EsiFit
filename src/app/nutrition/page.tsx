import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { NutritionView } from "@/features/nutrition/nutrition-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "تغذیه" };

export default async function NutritionPage() {
  const session = await getSessionUser();
  if (!session) redirect("/auth/login");
  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <NutritionView />
    </AppShell>
  );
}
