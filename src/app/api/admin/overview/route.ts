import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { lastNDaysISO } from "@/lib/dates/jalali";
import { resolveEnabledFlags } from "@/lib/feature-flags/registry";

/** GET /api/admin/overview — console metrics (admin-only). */
export async function GET() {
  try {
    await requireRole("admin");

    const since7 = new Date(`${lastNDaysISO(7)[0]}T00:00:00Z`);
    const since30 = new Date(`${lastNDaysISO(30)[0]}T00:00:00Z`);

    const [users, usersByRole, usersByTier, usersByStatus, sessions7d, newUsers30d, posts, comments, exercises, foods, recentUsers] =
      await Promise.all([
        db.user.count(),
        db.user.groupBy({ by: ["role"], _count: { role: true } }),
        db.user.groupBy({ by: ["tier"], _count: { tier: true } }),
        db.user.groupBy({ by: ["status"], _count: { status: true } }),
        db.workoutSession.count({ where: { status: "completed", startedAt: { gte: since7 } } }),
        db.user.count({ where: { createdAt: { gte: since30 } } }),
        db.post.count(),
        db.comment.count(),
        db.exercise.count(),
        db.food.count(),
        db.user.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, displayName: true, phone: true, role: true, tier: true, status: true, createdAt: true },
        }),
      ]);

    // Completion + PR activity for the week.
    const [prs7d, activeSessions] = await Promise.all([
      db.personalRecord.count({ where: { achievedAt: { gte: since7 } } }),
      db.workoutSession.count({ where: { status: "active" } }),
    ]);

    return NextResponse.json({
      ok: true,
      overview: {
        users,
        usersByRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count.role])),
        usersByTier: Object.fromEntries(usersByTier.map((r) => [r.tier, r._count.tier])),
        usersByStatus: Object.fromEntries(usersByStatus.map((r) => [r.status, r._count.status])),
        sessions7d,
        newUsers30d,
        posts,
        comments,
        exercises,
        foods,
        prs7d,
        activeSessions,
        recentUsers: recentUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
        flags: resolveEnabledFlags(),
      },
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
