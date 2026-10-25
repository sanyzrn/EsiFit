import { rateLimit } from "@/lib/http/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { appErrorResponse } from "@/lib/errors/respond";

const likeSchema = z.object({ postId: z.string(), liked: z.boolean() });

/** One logical like per (user, post) — enforced by unique constraint. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (session && session.role !== "member") return NextResponse.json({ ok: false, code: "authorization" }, { status: 403 });
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication", message: "برای پسندیدن وارد شوید." }, { status: 401 });
    }
    const body = likeSchema.parse(await req.json());

    const post = await db.post.findUnique({ where: { id: body.postId } });
    if (!post || post.visibility !== "public") return NextResponse.json({ ok: false, code: "not_found", message: "پست یافت نشد." }, { status: 404 });

    const limit = await rateLimit(`community:like:${session.id}`, 60, 60_000);
    if (!limit.ok) return NextResponse.json({ ok: false, code: "rate_limit", message: "پسندهای زیادی ثبت کرده‌اید؛ کمی بعد تلاش کنید.", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });

    if (body.liked) {
      await db.postLike.upsert({
        where: { postId_userId: { postId: body.postId, userId: session.id } },
        create: { postId: body.postId, userId: session.id }, update: {},
      });
    } else {
      await db.postLike.deleteMany({ where: { postId: body.postId, userId: session.id } });
    }
    const count = await db.postLike.count({ where: { postId: body.postId } });
    return NextResponse.json({ ok: true, likeCount: count });
  } catch (error) {
    return appErrorResponse(error);
  }
}
