import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { MEMBER_TIERS, storedTierForRole } from "@/lib/auth/access-policy";

const MANAGEABLE_ROLES = ["member", "coach"] as const;
const STATUSES = ["active", "suspended"] as const;

/** GET /api/admin/users?q=&page= — searchable user list (admin-only). */
export async function GET(req: Request) {
  try {
    await requireRole("admin");
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = 12;

    // The manager list never contains administrator accounts.
    const where = {
      role: { in: ["member", "coach"] },
      ...(q ? { OR: [{ displayName: { contains: q } }, { phone: { contains: q } }] } : {}),
    };

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          phone: true,
          displayName: true,
          role: true,
          tier: true,
          status: true,
          createdAt: true,
          _count: { select: { workoutSessions: true } },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), sessions: u._count.workoutSessions })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}

const patchSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(MANAGEABLE_ROLES).optional(),
  tier: z.enum(MEMBER_TIERS).optional(),
  status: z.enum(STATUSES).optional(),
}).strict().refine((data) => data.role != null || data.tier != null || data.status != null);

/** PATCH /api/admin/users — change role/tier/status with guardrails (admin-only). */
export async function PATCH(req: Request) {
  try {
    const session = await requireRole("admin");
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });
    }
    const { userId, role, tier, status } = parsed.data;

    const target = await db.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    }

    // Role and subscription are separate, and every staff account remains
    // outside member benefits. Admin identities are never edited in this UI.
    if (target.role === "admin" || target.id === session.id) {
      return NextResponse.json({
        ok: false, code: "conflict", message: "حساب مدیر فقط در بخش جداگانه مدیریت مدیران قابل ویرایش است.",
      }, { status: 409 });
    }

    const nextRole = role ?? target.role;
    const nextTier = storedTierForRole(nextRole as "member" | "coach", tier ?? (
      target.role === "member" && ["free", "vip", "vip_plus"].includes(target.tier)
        ? target.tier as "free" | "vip" | "vip_plus"
        : "free"
    ));

    // Staff accounts can't buy/select athlete tiers. A promotion resets the
    // neutral storage value but never silently cancels a paid subscription.
    if (nextRole !== "member" && tier != null && tier !== "free") {
      return NextResponse.json({
        ok: false, code: "validation", message: "اشتراک VIP فقط برای ورزشکار است.",
      }, { status: 400 });
    }

    const roleChange = nextRole !== target.role;
    const tierChange = nextTier !== target.tier;
    if (roleChange || tierChange) {
      const liveSubscription = await db.subscription.findFirst({
        where: {
          userId, status: "active", currentPeriodEndsAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (liveSubscription) {
        return NextResponse.json({
          ok: false, code: "conflict",
          message: "کاربر اشتراک فعال دارد؛ قبل از تغییر نقش یا سطح، وضعیت اشتراک او را جداگانه بررسی کنید.",
        }, { status: 409 });
      }
    }

    if (target.role === "coach" && nextRole !== "coach") {
      const assigned = await db.coachClient.count({ where: { coachId: userId, status: "active" } });
      if (assigned > 0) {
        return NextResponse.json({
          ok: false, code: "conflict",
          message: "اول ورزشکاران این مربی را از بخش «مربی‌ها و ورزشکاران» منتقل کنید.",
        }, { status: 409 });
      }
    }

    const updated = await db.$transaction(async (tx) => {
      // Promoting an athlete to staff must also remove their prior coach
      // relationship. No member can appear as both a coach and an athlete.
      if (roleChange && target.role === "member" && nextRole !== "member") {
        await tx.coachClient.deleteMany({ where: { athleteId: userId } });
        await tx.aiCoachEnrollment.deleteMany({ where: { athleteId: userId } });
      }
      const result = await tx.user.update({
        where: { id: userId },
        data: {
          ...(role != null ? { role: nextRole } : {}),
          ...(roleChange || tier != null || tierChange ? { tier: nextTier } : {}),
          ...(status != null ? { status } : {}),
        },
        select: { id: true, role: true, tier: true, status: true },
      });
      if (status === "suspended") {
        await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return result;
    });

    // Notify the user about meaningful changes.
    const messages: string[] = [];
    if (role != null && role !== target.role) {
      const roleFa: Record<string, string> = { member: "ورزشکار", coach: "مربی", admin: "مدیر" };
      messages.push(`نقش حساب شما به «${roleFa[role]}» تغییر کرد.`);
    }
    if (tierChange) {
      const tierFa: Record<string, string> = { free: "رایگان", vip: "وی‌آی‌پی", vip_plus: "وی‌آی‌پی پلاس" };
      messages.push(roleChange && nextRole !== "member" ? "اشتراک ورزشکاری هنگام تغییر نقش از حساب شما برداشته شد." : `اشتراک شما به «${tierFa[nextTier]}» تغییر کرد.`);
    }
    if (status === "suspended") messages.push("دسترسی حساب شما موقتاً محدود شده است.");
    if (status === "active" && target.status === "suspended") messages.push("دسترسی حساب شما بازگردانده شد.");
    if (messages.length > 0) {
      await db.notification.create({
        data: { userId, type: "system", title: "به‌روزرسانی حساب", body: messages.join(" ") },
      });
    }

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    return appErrorResponse(error);
  }
}
