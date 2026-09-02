import { redirect } from "next/navigation";
import { requireRolePage } from "@/lib/auth/page-guard";
import { AppShell } from "@/components/layout/app-shell";
import { AthleteDetailView } from "@/features/coach/athlete-detail-view";
import { db } from "@/lib/db";
import { getCoachAthleteDetail } from "@/lib/coach/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "پرونده ورزشکار — مربی" };

export default async function CoachAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRolePage("coach_or_admin");
  const { id } = await params;

  // Ownership: coaches only see their own athletes (admin supervises all).
  if (session.role !== "admin") {
    const link = await db.coachClient.findUnique({
      where: { coachId_athleteId: { coachId: session.id, athleteId: id } },
    });
    if (!link) redirect("/coach");
  }

  const detail = await getCoachAthleteDetail(id);
  if (!detail) redirect("/coach");

  return (
    <AppShell session={session}>
      <AthleteDetailView detail={detail} backHref="/coach" />
    </AppShell>
  );
}
