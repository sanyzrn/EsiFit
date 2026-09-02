import { requireRolePage } from "@/lib/auth/page-guard";
import { AppShell } from "@/components/layout/app-shell";
import { AdminConsoleView } from "@/features/admin/admin-console-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "کنسول مدیریت" };

export default async function AdminPage() {
  const session = await requireRolePage("admin");
  return (
    <AppShell session={session}>
      <AdminConsoleView adminName={session.displayName} />
    </AppShell>
  );
}
