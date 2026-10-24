import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { appErrorResponse } from "@/lib/errors/respond";
import { rateLimit } from "@/lib/http/rate-limit";

const commentSchema = z.object({ postId: z.string(), content: z.string().trim().min(1).max(300) });

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session && session.role !== "member") return NextResponse.json({ ok: false, code: "authorization" }, { status: 403 });
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
    if (!post || post.visibility !== "public") return NextResponse.json({ ok: false, code: "not_found", message: "پست یافت نشد." }, { status: 404 });

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

/** Stable chronological pages; hidden posts never expose their discussion. */
export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const { postId, cursor } = z.object({ postId: z.string().min(1).max(100), cursor: z.coerce.number().int().min(0).max(100000).default(0) })
      .parse({ postId: params.get("postId"), cursor: params.get("cursor") ?? undefined });
    const post = await db.post.findFirst({ where: { id: postId, visibility: "public" }, select: { id: true } });
    if (!post) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    const comments = await db.comment.findMany({
      where: { postId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: cursor, take: 21,
      include: { user: { select: { displayName: true } } },
    });
    return NextResponse.json({ ok: true,
      comments: comments.slice(0, 20).map(c => ({ id: c.id, content: c.content, author: c.user.displayName })),
      nextCursor: comments.length > 20 ? cursor + 20 : null,
    });
  } catch (error) { return appErrorResponse(error); }
}
