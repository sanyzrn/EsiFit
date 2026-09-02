import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";

const ROLES = ["member", "coach", "admin"] as const;
const TIERS = ["free", "vip", "vip_plus", "coach"] as const;
const STATUSES = ["active", "suspended"] as const;

/** GET /api/admin/users?q=&page= — searchable user list (admin-only). */
export async function GET(req: Request) {
  try {
    await requireRole("admin");
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = 12;

    const where = q
      ? {
          OR: [
            { displayName: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {};

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
  role: z.enum(ROLES).optional(),
  tier: z.enum(TIERS).optional(),
  status: z.enum(STATUSES).optional(),
});

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

    // Guardrail 1: never touch your own account.
    if (target.id === session.id) {
      return NextResponse.json(
        { ok: false, code: "conflict", message: "نمی‌توانید نقش یا وضعیت حساب خودتان را از اینجا تغییر دهید." },
        { status: 409 },
      );
    }

    // Guardrail 2: don't remove the last *active* admin. A target that is
    // already suspended is not one of them, so changing it can never lock us out.
    const demotingAdmin = role != null && target.role === "admin" && role !== "admin";
    const losesAdminAccess =
      target.role === "admin" &&
      target.status === "active" &&
      (demotingAdmin || status === "suspended");
    if (losesAdminAccess) {
      const adminCount = await db.user.count({ where: { role: "admin", status: "active" } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { ok: false, code: "conflict", message: "حداقل یک مدیر فعال باید باقی بماند." },
          { status: 409 },
        );
      }
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: { ...(role != null ? { role } : {}), ...(tier != null ? { tier } : {}), ...(status != null ? { status } : {}) },
      select: { id: true, role: true, tier: true, status: true },
    });

    // Suspend revokes all sessions immediately.
    if (status === "suspended") {
      await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    // Notify the user about meaningful changes.
    const messages: string[] = [];
    if (role != null && role !== target.role) {
      const roleFa: Record<string, string> = { member: "ورزشکار", coach: "مربی", admin: "مدیر" };
      messages.push(`نقش حساب شما به «${roleFa[role]}» تغییر کرد.`);
    }
    if (tier != null && tier !== target.tier) {
      const tierFa: Record<string, string> = { free: "رایگان", vip: "وی‌آی‌پی", vip_plus: "وی‌آی‌پی پلاس", coach: "مربی" };
      messages.push(`اشتراک شما به «${tierFa[tier]}» تغییر کرد.`);
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
