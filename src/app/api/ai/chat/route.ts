import { readJson } from "@/lib/http/read-json";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText, isStepCount } from "ai";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { appErrorResponse } from "@/lib/errors/respond";
import { getAiAccess } from "@/lib/ai/access";
import { configuredModel } from "@/lib/ai/provider";
import { assistantPrompt } from "@/lib/ai/prompt";
import { assistantTools } from "@/lib/ai/actions";
import {
  claimAiQuotaSlot,
  countAiQuotaUsage,
  assertQuotaClaim,
  finalizeAiQuota,
  releaseAiQuotaSlot,
} from "@/lib/ai/quota";

export const maxDuration = 60;
const bodySchema = z
  .object({
    conversationId: z.string().optional(),
    requestId: z.string().uuid().optional(),
    providerId: z.string().optional(),
    message: z.string().trim().min(1).max(1200),
  })
  .strict();
const actionSelect = {
  id: true,
  preview: true,
  status: true,
  expiresAt: true,
  resultJson: true,
} as const;

export async function GET(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor) throw new AppError("authentication");
    let access:Awaited<ReturnType<typeof getAiAccess>>|undefined;
    let unavailableReason:string|undefined;
    try { access=await getAiAccess(actor); }
    catch(error){if(error instanceof AppError)unavailableReason=error.userMessage;else throw error;}
    const conversations = await db.aiConversation.findMany({
      where: { userId: actor.id, contextType: `hampa:${actor.role}` },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true },
    });
    const url = new URL(req.url);
    const recoveryId = url.searchParams.get("requestId");
    const recovery = recoveryId ? await db.aiUsageLog.findFirst({where:{requestId:`chat:${actor.id}:${recoveryId}`,userId:actor.id,purpose:"chat"},select:{conversationId:true,status:true}}) : null;
    const selected = recovery?.conversationId ?? url.searchParams.get("conversationId");
    const conversation = conversations.find((item) => item.id === selected);
    if (selected && !conversation) throw new AppError("not_found");
    const [messages, actions, used, monthUsed, providers] = await Promise.all([
      conversation
        ? db.aiMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 60,
            select: { id: true, role: true, content: true, status: true },
          })
        : [],
      conversation
        ? db.aiAction.findMany({
            where: { actorId: actor.id, conversationId: conversation.id },
            orderBy: { createdAt: "asc" },
            select: actionSelect,
          })
        : [],
      countAiQuotaUsage(actor.id, actor.timezone),
      countAiQuotaUsage(actor.id, actor.timezone, true),
      actor.role === "admin"
        ? db.aiProvider.findMany({
            where: { enabled: true },
            select: { id: true, label: true },
          })
        : [],
    ]);
    return NextResponse.json({
      ok: true,
      available: Boolean(access),
      reason: unavailableReason,
      recoveryStatus: recovery?.status,
      conversations,
      conversationId: conversation?.id,
      messages: messages.reverse(),
      actions,
      provider: access ? { id: access.provider.id, label: access.provider.label } : undefined,
      providers,
      quota: access ? {
        used,
        limit: access.dailyLimit,
        monthUsed,
        monthlyLimit: access.monthlyLimit,
      } : undefined,
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}

export async function POST(req: Request) {
  let requestId: string | undefined;
  let conversationId: string | undefined;
  let userMessageId: string | undefined;
  try {
    const actor = await getSessionUser();
    if (!actor) throw new AppError("authentication");
    const body = bodySchema.parse(await readJson(req));
    const access = await getAiAccess(actor, body.providerId);
    if (body.conversationId) {
      const conversation = await db.aiConversation.findFirst({
        where: {
          id: body.conversationId,
          userId: actor.id,
          contextType: `hampa:${actor.role}`,
        },
      });
      if (!conversation) throw new AppError("not_found");
      conversationId = conversation.id;
    }
    const clientKey=body.requestId?`chat:${actor.id}:${body.requestId}`:undefined;
    if(clientKey){
      const previous=await db.aiUsageLog.findUnique({where:{requestId:clientKey}});
      if(previous){
        if(previous.userId!==actor.id)throw AppError.from("authorization");
        const previousConversation=previous.conversationId?await db.aiConversation.findFirst({where:{id:previous.conversationId,userId:actor.id,contextType:`hampa:${actor.role}`}}):null;
        if(previous.conversationId&&!previousConversation)throw AppError.from("authorization");
        const saved=await db.aiMessage.findMany({where:{requestId:clientKey},select:{id:true,role:true,content:true}});
        const oldUser=saved.find(m=>m.role==='user');
        if(oldUser&&oldUser.content!==body.message)throw AppError.from("conflict","شناسهٔ درخواست برای پیام دیگری استفاده شده است.");
        const reply=saved.find(m=>m.role==='assistant');
        if(reply&&previous.status==='success')return NextResponse.json({ok:true,conversationId:previous.conversationId,userMessageId:oldUser?.id,message:{id:reply.id,content:reply.content},actions:await db.aiAction.findMany({where:{actorId:actor.id,requestId:clientKey},select:actionSelect}),quota:{used:await countAiQuotaUsage(actor.id,actor.timezone),limit:access.dailyLimit,monthUsed:await countAiQuotaUsage(actor.id,actor.timezone,true),monthlyLimit:access.monthlyLimit}});
        if(previous.status==='pending'&&previous.createdAt.getTime()>Date.now()-120000)return NextResponse.json({ok:true,pending:true,conversationId:previous.conversationId},{status:202});
        if(previous.status==='pending')await releaseAiQuotaSlot(clientKey);
        throw AppError.from("provider","درخواست قبلی کامل نشده است؛ ابتدا گفتگو را بازیابی کن و سپس در صورت نیاز دوباره بفرست.");
      }
    }
    const claim = await claimAiQuotaSlot({
      userId: actor.id,
      requestId: clientKey,
      timezone: actor.timezone,
      limit: access.dailyLimit,
      monthlyLimit: access.monthlyLimit,
      provider: access.provider.id,
      model: access.provider.model,
      conversationId,
    });
    assertQuotaClaim(claim);
    if(claim.duplicate)return NextResponse.json({ok:true,pending:true,conversationId},{status:202});
    requestId = claim.requestId;
    if (!conversationId) {
      const conversation = await db.aiConversation.create({
        data: {
          userId: actor.id,
          contextType: `hampa:${actor.role}`,
          title: body.message.slice(0, 50),
        },
      });
      conversationId = conversation.id;
    }
    await db.aiUsageLog.update({
      where: { requestId },
      data: { conversationId },
    });
    const userMessage = await db.aiMessage.create({
      data: { conversationId, requestId, role: "user", content: body.message },
    });
    userMessageId = userMessage.id;
    const history = await db.aiMessage.findMany({
      where: {
        conversationId,
        status: "complete",
        role: { in: ["user", "assistant"] },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 12,
    });
    const startedAt = Date.now();
    let result;
    try {
      result = await generateText({
        model: configuredModel(access.provider),
        system: assistantPrompt(actor),
        messages: history
          .reverse()
          .map((message) => ({
            role: message.role as "user" | "assistant",
            content: message.content,
          })),
        tools: assistantTools(actor, conversationId, requestId),
        stopWhen: isStepCount(4),
        maxOutputTokens: 1800,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(45000),
      });
    } catch {
      throw new AppError("provider", {
        userMessage:
          "ارتباط همپا با مدل کامل نشد. سهمیه مصرف نشد؛ کمی بعد دوباره تلاش کنید.",
      });
    }
    const actions = await db.aiAction.findMany({
      where: {
        actorId: actor.id,
        conversationId,
        requestId,
        status: "pending",
      },
      select: actionSelect,
      take: 3,
    });
    const content =
      result.text.trim() ||
      (actions.length
        ? "پیشنهاد زیر آمادهٔ بررسی شماست. هنوز تغییری اجرا نشده است."
        : "پاسخ متنی آماده نشد. لطفاً درخواست را کوتاه‌تر و مشخص‌تر بنویسید.");
    if (!result.text.trim() && !actions.length)
      throw new AppError("provider", {
        userMessage: "مدل پاسخ قابل استفاده نداد؛ سهمیه مصرف نشد.",
      });
    const message = await db.aiMessage.create({
      data: {
        conversationId,
        role: "assistant",
        requestId,
        content: content.slice(0, 16000),
      },
    });
    await db.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    await finalizeAiQuota(requestId, {
      conversationId,
      latencyMs: Date.now() - startedAt,
      promptTokens: result.totalUsage.inputTokens ?? 0,
      completionTokens: result.totalUsage.outputTokens ?? 0,
      totalTokens: result.totalUsage.totalTokens ?? 0,
    });
    return NextResponse.json({
      ok: true,
      conversationId,
      userMessageId: userMessage.id,
      message: { id: message.id, content: message.content },
      actions,
      quota: {
        used: claim.used,
        limit: access.dailyLimit,
        monthUsed: await countAiQuotaUsage(actor.id, actor.timezone, true),
        monthlyLimit: access.monthlyLimit,
      },
    });
  } catch (error) {
    if (userMessageId)
      await db.aiMessage
        .updateMany({
          where: { id: userMessageId },
          data: { status: "failed" },
        })
        .catch(() => {});
    if (requestId) await releaseAiQuotaSlot(requestId).catch(() => {});
    if (conversationId && requestId) {
      // A failed provider may already have proposed a change. Never leave such a proposal actionable.
      await db.aiAction
        .updateMany({
          where: { conversationId, requestId, status: "pending" },
          data: { status: "cancelled" },
        })
        .catch(() => {});
    }
    return appErrorResponse(error);
  }
}
