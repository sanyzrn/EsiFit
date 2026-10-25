import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appErrorResponse } from "@/lib/errors/respond";
import { getXpTotal, refreshDerivedMissions } from "@/lib/domain/gamification-engine";
import { levelFromXp } from "@/lib/domain/body-math";
import { todayISO, weekStartISO } from "@/lib/dates/jalali";

export async function GET() {
  try {
    const session = await requireMember();
    await refreshDerivedMissions(session.id, session.timezone);
    const [xp, badges, earned, missions, progress] = await Promise.all([
      getXpTotal(session.id),
      db.badge.findMany({ orderBy: [{ tier: "asc" }, { criteriaValue: "asc" }] }),
      db.userBadge.findMany({ where: { userId: session.id }, include: { badge: true } }),
      db.mission.findMany({ where: { active: true } }),
      db.userMissionProgress.findMany({ where: { userId: session.id } }),
    ]);

    const today = todayISO(session.timezone);
    const weekStart = weekStartISO(today);

    const earnedByBadgeId = new Map(earned.map((e) => [e.badgeId, e]));

    const missionState = missions.map((m) => {
      const p = progress.find(
        (x) => x.missionId === m.id && (m.period === "daily" ? x.periodKey === today : x.periodKey === weekStart),
      );
      return {
        id: m.id,
        name: m.nameFa,
        description: m.descriptionFa,
        period: m.period as "daily" | "weekly",
        target: m.target,
        progress: p?.progress ?? 0,
        claimed: p?.claimed ?? false,
        xpReward: m.xpReward,
        criteriaType: m.criteriaType,
      };
    });

    return NextResponse.json({
      ok: true,
      xp,
      level: levelFromXp(xp),
      badges: badges.map((b) => {
        const e = earnedByBadgeId.get(b.id);
        return {
          id: b.id,
          slug: b.slug,
          name: b.nameFa,
          description: b.descriptionFa,
          icon: b.icon,
          tier: b.tier as "bronze" | "silver" | "gold",
          earnedAt: e?.earnedAt ?? null,
          criteriaValue: b.criteriaValue,
          criteriaType: b.criteriaType,
        };
      }),
      missions: missionState,
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
