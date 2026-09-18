import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { appErrorResponse } from "@/lib/errors/respond";

const joinSchema = z.object({ challengeId: z.string() });

export async function GET() {
  try {
    const session = await getSessionUser();
    const challenges = await db.challenge.findMany({
      where: { status: "active" },
      include: {
        participants: {
          include: { user: { select: { displayName: true, tier: true } } },
          orderBy: { score: "desc" },
          take: 10,
        },
        _count: { select: { participants: true } },
      },
      orderBy: { startDate: "desc" },
    });

    const leaderboardFor = (ch: typeof challenges[number]) =>
      ch.participants.map((p, i) => ({
        rank: i + 1,
        name: p.user.displayName,
        tier: p.user.tier,
        score: p.score,
        isMe: session ? p.userId === session.id : false,
      }));

    return NextResponse.json({
      ok: true,
      challenges: challenges.map((ch) => ({
        id: ch.id,
        slug: ch.slug,
        name: ch.nameFa,
        description: ch.description,
        metric: ch.metric,
        targetValue: ch.targetValue,
        emoji: ch.emoji,
        participantCount: ch._count.participants,
        joined: session ? ch.participants.some((p) => p.userId === session.id) : false,
        myScore: session ? (ch.participants.find((p) => p.userId === session.id)?.score ?? null) : null,
        leaderboard: leaderboardFor(ch),
        daysLeft: Math.max(0, Math.ceil((new Date(ch.endDate).getTime() - Date.now()) / 86400000)),
      })),
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication", message: "برای عضویت در چالش وارد شوید." }, { status: 401 });
    }
    const body = joinSchema.parse(await req.json());
    const challenge = await db.challenge.findUnique({ where: { id: body.challengeId } });
    if (!challenge || challenge.status !== "active") {
      return NextResponse.json({ ok: false, code: "not_found", message: "چالش فعال نیست." }, { status: 404 });
    }
    const created = await db.challengeParticipant
      .create({ data: { challengeId: challenge.id, userId: session.id, score: 0 } })
      .catch(() => null);
    return NextResponse.json({ ok: true, alreadyJoined: !created });
  } catch (error) {
    return appErrorResponse(error);
  }
}
