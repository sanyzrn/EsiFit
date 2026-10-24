import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";
import { db } from "@/lib/db";
import { z } from "zod";
import { rateLimit } from "@/lib/http/rate-limit";

const querySchema = z.object({ cursor: z.string().min(1).max(200).optional(), scope: z.enum(["all", "mine"]).default("all") });
const postSchema = z.object({ content: z.string().trim().min(3).max(500) });

/** Public posts; current-user reaction and ownership are private, never CDN cached. */
export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const query = querySchema.parse({ cursor: params.get("cursor") ?? undefined, scope: params.get("scope") ?? undefined });
    const position = query.cursor ? z.tuple([z.string().datetime(), z.string().min(1).max(100)]).parse(query.cursor.split("!")) : null;
    const session = await getSessionUser();
    if (query.scope === "mine" && !session) return NextResponse.json({ ok: false, code: "authentication" }, { status: 401 });
    const posts = await db.post.findMany({
      where: { visibility: "public", ...(query.scope === "mine" ? { userId: session!.id } : {}),
        ...(position ? { OR: [{ createdAt: { lt: new Date(position[0]) } }, { createdAt: new Date(position[0]), id: { lt: position[1] } }] } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 13,
      include: {
        user: { select: { id: true, displayName: true, tier: true } },
        likes: { where: { userId: session?.id ?? "" }, select: { id: true } },
        comments: {
          include: { user: { select: { displayName: true } } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 3,
        },
        _count: { select: { comments: true, likes: true } },
      },
    });
    const page = posts.slice(0, 12);
    return NextResponse.json({
      ok: true,
      posts: page.map((p) => ({
        id: p.id, content: p.content, workoutType: p.workoutType, createdAt: p.createdAt,
        author: { id: p.user.id, name: p.user.displayName, tier: p.user.tier },
        liked: p.likes.length > 0, isOwner: p.userId === session?.id,
        likeCount: p._count.likes, commentCount: p._count.comments,
        comments: p.comments.map((c) => ({ id: c.id, content: c.content, author: c.user.displayName })),
      })),
      nextCursor: posts.length > 12 ? `${page[page.length - 1].createdAt.toISOString()}!${page[page.length - 1].id}` : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return appErrorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, code: "authentication", message: "برای انتشار پست وارد شوید." }, { status: 401 });
    if (session.role !== "member") return NextResponse.json({ ok: false, code: "authorization" }, { status: 403 });
    if (!rateLimit(`community:post:${session.id}`, 10, 60 * 60 * 1000).ok) {
      return NextResponse.json({ ok: false, code: "rate_limit", message: "تعداد پست‌ها زیاد بوده است. کمی بعد تلاش کنید." }, { status: 429 });
    }
    const body = postSchema.parse(await req.json());
    const post = await db.post.create({
      data: { userId: session.id, content: body.content, visibility: "public" },
      include: { user: { select: { id: true, displayName: true, tier: true } } },
    });
    return NextResponse.json({ ok: true, post: {
      id: post.id, content: post.content, workoutType: null, createdAt: post.createdAt,
      author: { id: post.user.id, name: post.user.displayName, tier: post.user.tier },
      liked: false, isOwner: true, likeCount: 0, commentCount: 0, comments: [],
    } });
  } catch (error) { return appErrorResponse(error); }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, code: "authentication" }, { status: 401 });
    if (session.role !== "member") return NextResponse.json({ ok: false, code: "authorization" }, { status: 403 });
    const { postId } = z.object({ postId: z.string().min(1).max(100) }).parse(await req.json());
    // Scope the mutation itself to its owner. Comments and likes cascade in Prisma.
    const result = await db.post.deleteMany({ where: { id: postId, userId: session.id } });
    if (!result.count) return NextResponse.json({ ok: false, code: "not_found", message: "پست یافت نشد." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return appErrorResponse(error); }
}
