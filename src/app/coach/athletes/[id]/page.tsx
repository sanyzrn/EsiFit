import { resolveEnabledFlags } from "@/lib/feature-flags/registry";
import { loadExerciseCatalog } from "@/lib/workout/catalog";
import { redirect } from "next/navigation";
import { requireRolePage } from "@/lib/auth/page-guard";
import { AppShell } from "@/components/layout/app-shell";
import { AthleteDetailView } from "@/features/coach/athlete-detail-view";
import { db } from "@/lib/db";
import { getCoachAthleteDetail } from "@/lib/coach/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "پرونده ورزشکار — مربی" };

export default async function CoachAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRolePage(`/coach/athletes/${encodeURIComponent(id)}`, "coach_or_admin");

  // Ownership: coaches only see their own athletes (admin supervises all).
  let coachNote = "";
  if (session.role !== "admin") {
    const link = await db.coachClient.findUnique({
      where: { coachId_athleteId: { coachId: session.id, athleteId: id } },
    });
    if (!link || link.status !== "active") redirect("/coach");
    coachNote = link.note;
  }

  const [detail, catalog] = await Promise.all([getCoachAthleteDetail(id), loadExerciseCatalog()]);
  if (!detail) redirect("/coach");

  return (
    <AppShell session={session} flags={resolveEnabledFlags()}>
      <AthleteDetailView detail={detail} backHref={session.role === "admin" ? "/admin" : "/coach"} catalog={catalog.map(({id,slug,nameFa,equipment})=>({id,slug,nameFa,equipment}))} coachNote={coachNote} canManage={session.role === "coach"} />
    </AppShell>
  );
}
