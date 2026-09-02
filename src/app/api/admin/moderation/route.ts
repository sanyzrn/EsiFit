import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";

/** GET /api/admin/moderation — latest community content for review (admin-only). */
export async function GET() {
  try {
    await requireRole("admin");

    const [posts, comments] = await Promise.all([
      db.post.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          user: { select: { displayName: true, role: true } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      db.comment.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          user: { select: { displayName: true, role: true } },
          post: { select: { id: true, content: true } },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      posts: posts.map((p) => ({
        id: p.id,
        content: p.content,
        author: p.user.displayName,
        authorRole: p.user.role,
        createdAt: p.createdAt.toISOString(),
        likeCount: p._count.likes,
        commentCount: p._count.comments,
      })),
      comments: comments.map((c) => ({
        id: c.id,
        content: c.content,
        author: c.user.displayName,
        authorRole: c.user.role,
        createdAt: c.createdAt.toISOString(),
        postExcerpt: c.post.content.slice(0, 60),
      })),
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}

const deleteSchema = z.object({
  kind: z.enum(["post", "comment"]),
  id: z.string().min(1),
  reason: z.string().max(200).optional(),
});

/** DELETE /api/admin/moderation — remove a post or comment (admin + coach for own scope). */
export async function DELETE(req: Request) {
  try {
    const session = await requireRole("coach_or_admin");
    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, code: "validation" }, { status: 400 });
    }
    const { kind, id, reason } = parsed.data;

    if (kind === "post") {
      const post = await db.post.findUnique({ where: { id }, include: { user: true } });
      if (!post) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });

      // Coaches may only moderate their own roster athletes' content.
      if (session.role !== "admin") {
        const link = await db.coachClient.findUnique({
          where: { coachId_athleteId: { coachId: session.id, athleteId: post.userId } },
        });
        if (!link) {
          return NextResponse.json({ ok: false, code: "authorization" }, { status: 403 });
        }
      }

      await db.post.delete({ where: { id } });
      await db.notification.create({
        data: {
          userId: post.userId,
          type: "system",
          title: "حذف یک پست",
          body: `یکی از پست‌های شما توسط تیم مدیریت حذف شد.${reason ? ` دلیل: ${reason}` : ""}`,
        },
      });
      return NextResponse.json({ ok: true });
    }

    const comment = await db.comment.findUnique({ where: { id } });
    if (!comment) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });

    if (session.role !== "admin") {
      const link = await db.coachClient.findUnique({
        where: { coachId_athleteId: { coachId: session.id, athleteId: comment.userId } },
      });
      if (!link) return NextResponse.json({ ok: false, code: "authorization" }, { status: 403 });
    }

    await db.comment.delete({ where: { id } });
    await db.notification.create({
      data: {
        userId: comment.userId,
        type: "system",
        title: "حذف یک دیدگاه",
        body: `یکی از دیدگاه‌های شما توسط تیم مدیریت حذف شد.${reason ? ` دلیل: ${reason}` : ""}`,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return appErrorResponse(error);
  }
}
