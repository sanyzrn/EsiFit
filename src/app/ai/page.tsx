import { loginPath } from "@/lib/auth/return-path";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { AIAssistantView } from "@/features/ai/ai-assistant-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "همپا — دستیار اسی‌فیت" };

export default async function AIPage() {
  const session = await getSessionUser();
  if (!session) redirect(loginPath("/ai"));
  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <AIAssistantView role={session.role} userId={session.id} />
    </AppShell>
  );
}
