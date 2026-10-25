import { resolveFeatureFlag } from "@/lib/feature-flags/registry";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates/jalali";
import { z } from "zod";
import { appErrorResponse } from "@/lib/errors/respond";

const joinSchema = z.object({ challengeId: z.string() });

export async function GET() {
  try {
    if (!resolveFeatureFlag("CHALLENGES")) return NextResponse.json({ ok: true, challenges: [], enabled: false });
    const session = await getSessionUser();
    const today = todayISO(session?.timezone);
    const challenges = await db.challenge.findMany({
      where: { status: "active", startDate: { lte: today }, endDate: { gte: today },
        OR: [{ isPrivate: false }, ...(session && resolveFeatureFlag("PRIVATE_CHALLENGES") ? [{ ownerUserId: session.id }, { participants: { some: { userId: session.id } } }] : [])],
      },
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

    // Membership must not depend on whether the athlete ranks in the top ten.
    const memberships = session ? await db.challengeParticipant.findMany({
      where: { userId: session.id, challengeId: { in: challenges.map(ch => ch.id) } },
      select: { challengeId: true, score: true },
    }) : [];
    const mine = new Map(memberships.map(p => [p.challengeId, p.score]));

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
        joined: mine.has(ch.id),
        myScore: mine.get(ch.id) ?? null,
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
    if (session.role !== "member") return NextResponse.json({ ok: false, code: "authorization", message: "چالش‌های ورزشی مخصوص ورزشکاران هستند." }, { status: 403 });
    if (!resolveFeatureFlag("CHALLENGES")) return NextResponse.json({ ok: false, code: "not_found", message: "چالش‌ها تا آماده‌شدن امتیازدهی واقعی در دسترس نیستند." }, { status: 404 });
    const body = joinSchema.parse(await req.json());
    const challenge = await db.challenge.findUnique({ where: { id: body.challengeId } });
    if (!challenge || challenge.status !== "active" || challenge.startDate > todayISO(session.timezone) || challenge.endDate < todayISO(session.timezone)) {
      return NextResponse.json({ ok: false, code: "not_found", message: "چالش فعال نیست." }, { status: 404 });
    }
    if (challenge.isPrivate && !resolveFeatureFlag("PRIVATE_CHALLENGES")) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
    if (challenge.isPrivate && challenge.ownerUserId !== session.id) {
      const existing = await db.challengeParticipant.findUnique({
        where: { challengeId_userId: { challengeId: challenge.id, userId: session.id } }, select: { id: true },
      });
      if (!existing) return NextResponse.json({ ok: false, code: "not_found", message: "چالش در دسترس نیست." }, { status: 404 });
    }
    await db.challengeParticipant.upsert({
      where: { challengeId_userId: { challengeId: challenge.id, userId: session.id } },
      create: { challengeId: challenge.id, userId: session.id, score: 0 }, update: {},
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return appErrorResponse(error);
  }
}
