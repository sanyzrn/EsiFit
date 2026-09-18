import { NextRequest, NextResponse } from "next/server";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { z } from "zod";
import { rateLimit } from "@/lib/http/rate-limit";

const schema = z.object({ cursor: z.number().int().min(0).optional() });

/** Community feed — public read. */
export async function GET(req: NextRequest) {
  try {
    const cursor = schema.parse({ cursor: new URL(req.url).searchParams.get("cursor") ?? undefined }).cursor ?? 0;
    const posts = await db.post.findMany({
      where: { visibility: "public" },
      orderBy: { createdAt: "desc" },
      skip: cursor,
      take: 12,
      include: {
        user: { select: { id: true, displayName: true, tier: true } },
        comments: {
          include: { user: { select: { displayName: true } } },
          orderBy: { createdAt: "asc" },
          take: 3,
        },
        _count: { select: { comments: true, likes: true } },
      },
    });
    return NextResponse.json({
      ok: true,
      posts: posts.map((p) => ({
        id: p.id,
        content: p.content,
        workoutType: p.workoutType,
        createdAt: p.createdAt,
        author: { id: p.user.id, name: p.user.displayName, tier: p.user.tier },
        likeCount: p._count.likes,
        commentCount: p._count.comments,
        comments: p.comments.map((c) => ({ id: c.id, content: c.content, author: c.user.displayName })),
      })),
      nextCursor: posts.length === 12 ? cursor + 12 : null,
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}

const postSchema = z.object({ content: z.string().min(3).max(500) });

export async function POST(req: NextRequest) {
  try {
    const { getSessionUser } = await import("@/lib/auth/session");
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication", message: "برای انتشار پست وارد شوید." }, { status: 401 });
    }
    const rl = rateLimit(`community:post:${session.id}`, 10, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, code: "rate_limit", message: "تعداد پست‌ها زیاد بوده است. کمی بعد تلاش کنید." },
        { status: 429 },
      );
    }
    const body = postSchema.parse(await req.json());
    const content = body.content.trim();
    const post = await db.post.create({
      data: { userId: session.id, content, visibility: "public" },
      include: { user: { select: { id: true, displayName: true, tier: true } }, _count: { select: { likes: true, comments: true } } },
    });
    return NextResponse.json({
      ok: true,
      post: {
        id: post.id, content: post.content, workoutType: null, createdAt: post.createdAt,
        author: { id: post.user.id, name: post.user.displayName, tier: post.user.tier },
        likeCount: 0, commentCount: 0, comments: [],
      },
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
