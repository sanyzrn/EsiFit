import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { appErrorResponse } from "@/lib/errors/respond";
import { rateLimit } from "@/lib/http/rate-limit";

const commentSchema = z.object({ postId: z.string(), content: z.string().min(1).max(300) });

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication", message: "برای نظر دادن وارد شوید." }, { status: 401 });
    }
    const rl = rateLimit(`community:comment:${session.id}`, 30, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, code: "rate_limit", message: "نظرات زیادی ثبت کرده‌اید. کمی بعد تلاش کنید." },
        { status: 429 },
      );
    }
    const body = commentSchema.parse(await req.json());
    const post = await db.post.findUnique({ where: { id: body.postId } });
    if (!post) return NextResponse.json({ ok: false, code: "not_found", message: "پست یافت نشد." }, { status: 404 });

    const comment = await db.comment.create({
      data: { postId: body.postId, userId: session.id, content: body.content.trim() },
      include: { user: { select: { displayName: true } } },
    });
    const count = await db.comment.count({ where: { postId: body.postId } });
    return NextResponse.json({
      ok: true,
      comment: { id: comment.id, content: comment.content, author: comment.user.displayName },
      commentCount: count,
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
