import { NextRequest, NextResponse } from "next/server";
import { appErrorResponse } from "@/lib/errors/respond";
import ZAI from "z-ai-web-dev-sdk";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toAppError, AppError } from "@/lib/errors/app-error";
import { getEntitlements, type UserTier } from "@/lib/entitlements/entitlements";
import { z } from "zod";
import { formatJalaliNumeric, todayISO } from "@/lib/dates/jalali";

/**
 * AI assistant — provider-agnostic server adapter.
 * Quota per tier enforced HERE (server), usage logged per DATA_MODEL §13.
 * Provider secrets never reach the client. Persian system prompt with
 * conservative health messaging per TECH_ARCHITECTURE §10.1.
 */

const schema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(1200),
});

const SYSTEM_PROMPT = `تو «مربی اسی‌فیت» هستی — دستیار هوشمند یک اپلیکیشن فارسی تناسب اندام.
قوانین پاسخ:
- همیشه فقط به زبان فارسی روان پاسخ بده.
- کوتاه، کاربردی و ساختارمند پاسخ بده (حداکثر ۱۸۰ کلمه مگر کاربر جزئیات بخواهد).
- ایمنی اول است: هرگز تشخیص پزشکی نده، دارو تجویز نکن و درد را جدی بگیر. اگر کاربر از درد تیز، سرگیجه، درد قفسه سینه یا تورم گفت، تمرین را متوقف و مراجعه به پزشک را توصیه کن.
- برای رژیم خاص (بارداری، دیابت، بیماری کلیوی، اختلال خوردن، سن زیر ۱۸) توصیه کن با متخصص مشورت کند.
- وعده قطعی نده: «کمک می‌کند» درست است، «تضمین می‌شود» نادرست.
- برنامه تمرینی که پیشنهاد می‌دهی ساختار مشخص داشته باشد (حرکت، ست، تکرار، استراحت).
- اعداد را با ارقام فارسی بنویس.`;

async function countDailyUsage(userId: string): Promise<number> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  return db.aiUsageLog.count({
    where: { userId, createdAt: { gte: dayStart }, status: "success" },
  });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication", message: "برای گفتگو با دستیار هوشمند وارد شوید." }, { status: 401 });
    }

    const body = schema.parse(await req.json());

    // ---- Quota (server-side entitlement) ----
    const ent = getEntitlements(session.tier as UserTier);
    const used = await countDailyUsage(session.id);
    if (used >= ent.aiMessagesPerDay) {
      throw new AppError("quota", {
        userMessage: `سهمیه روزانه (${ent.aiMessagesPerDay} پیام) تمام شده است. با ارتقای پلن سهمیه بیشتری بگیرید.`,
      });
    }

    // ---- Conversation ----
    let conversationId = body.conversationId;
    if (conversationId) {
      const conv = await db.aiConversation.findUnique({ where: { id: conversationId } });
      if (!conv || conv.userId !== session.id) conversationId = undefined;
    }
    if (!conversationId) {
      const conv = await db.aiConversation.create({
        data: { userId: session.id, title: body.message.slice(0, 40), contextType: "general" },
      });
      conversationId = conv.id;
    }

    const userMessage = await db.aiMessage.create({
      data: { conversationId, role: "user", content: body.message, status: "complete" },
    });

    // ---- Context: brief member snapshot (deterministic data, not AI truth) ----
    const today = todayISO(session.timezone);
    const [profile, recentSessions, latestWeight] = await Promise.all([
      db.userProfile.findUnique({ where: { userId: session.id } }),
      db.workoutSession.findMany({
        where: { userId: session.id, status: "completed" },
        orderBy: { startedAt: "desc" },
        take: 3,
        select: { name: true, totalVolumeKg: true, startedAt: true },
      }),
      db.bodyMeasurement.findFirst({ where: { userId: session.id, weightKg: { not: null } }, orderBy: { measuredOn: "desc" } }),
    ]);
    const contextLines = [
      `امروز: ${formatJalaliNumeric(new Date())}`,
      profile?.heightCm ? `قد کاربر: ${profile.heightCm} سانتی‌متر` : null,
      latestWeight?.weightKg ? `وزن ثبت‌شده اخیر: ${latestWeight.weightKg} کیلوگرم` : null,
      profile?.primaryGoal ? `هدف: ${profile.primaryGoal === "build_muscle" ? "عضله‌سازی" : profile.primaryGoal === "lose_weight" ? "کاهش وزن" : profile.primaryGoal === "endurance" ? "استقامت" : profile.primaryGoal === "recomp" ? "ریکامپ" : "سلامت عمومی"}` : null,
      profile?.experienceLevel ? `سطح تجربه: ${profile.experienceLevel === "beginner" ? "مبتدی" : profile.experienceLevel === "intermediate" ? "متوسط" : "پیشرفته"}` : null,
      recentSessions.length ? `سه تمرین اخیر: ${recentSessions.map((s) => s.name).join("، ")}` : null,
    ].filter(Boolean);
    const deepContext = ent.aiDeepContext ? contextLines.join("\n") : "";

    // ---- Provider call (server-only adapter) ----
    const history = await db.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { role: true, content: true },
    });
    const messages = [
      { role: "assistant" as const, content: SYSTEM_PROMPT },
      ...(deepContext ? [{ role: "assistant" as const, content: `زمینه کاربر:\n${deepContext}` }] : []),
      ...history.reverse().map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
    ];

    const zai = await ZAI.create();
    let assistantText = "";
    try {
      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: "disabled" },
      });
      assistantText = completion.choices[0]?.message?.content ?? "";
    } catch (providerError) {
      await db.aiUsageLog.create({
        data: { userId: session.id, conversationId, status: "failed", latencyMs: Date.now() - startedAt },
      });
      await db.aiMessage.create({
        data: { conversationId, role: "system_notice", content: "پاسخ هوشمند موقتاً در دسترس نیست.", status: "failed" },
      });
      throw new AppError("provider", { userMessage: "دستیار موقتاً در دسترس نیست. چند لحظه دیگر تلاش کنید.", cause: providerError });
    }

    const assistantMessage = await db.aiMessage.create({
      data: { conversationId, role: "assistant", content: assistantText, status: "complete" },
    });

    await db.aiUsageLog.create({
      data: {
        userId: session.id,
        conversationId,
        provider: "z-ai",
        model: "glm-4-flash",
        promptTokens: Math.round(body.message.length / 3),
        completionTokens: Math.round(assistantText.length / 3),
        totalTokens: Math.round((body.message.length + assistantText.length) / 3),
        latencyMs: Date.now() - startedAt,
        status: "success",
      },
    });

    return NextResponse.json({
      ok: true,
      conversationId,
      userMessageId: userMessage.id,
      message: { id: assistantMessage.id, content: assistantText },
      quota: { used: used + 1, limit: ent.aiMessagesPerDay },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.userMessage }, { status: error.code === "quota" ? 429 : 502 });
    }
    return appErrorResponse(error);
  }
}
