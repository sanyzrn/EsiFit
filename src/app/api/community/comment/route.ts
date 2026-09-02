import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { appErrorResponse } from "@/lib/errors/respond";

const commentSchema = z.object({ postId: z.string(), content: z.string().min(1).max(300) });

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication", message: "برای نظر دادن وارد شوید." }, { status: 401 });
    }
    const body = commentSchema.parse(await req.json());
    const post = await db.post.findUnique({ where: { id: body.postId } });
    if (!post) return NextResponse.json({ ok: false, code: "not_found", message: "پست یافت نشد." }, { status: 404 });

    const comment = await db.comment.create({
      data: { postId: body.postId, userId: session.id, content: body.content },
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
