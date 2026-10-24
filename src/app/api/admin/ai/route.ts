import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { appErrorResponse } from "@/lib/errors/respond";
import { providerInput, grantInput } from "@/lib/ai/provider-config";
import {
  normalizedInput,
  probeProvider,
  safeProvider,
} from "@/lib/ai/provider";
import { encryptProviderKey } from "@/lib/ai/secrets";
import { z } from "zod";
import { countAiQuotaUsage } from "@/lib/ai/quota";

export async function GET(req: Request) {
  try {
    await requireRole("admin");
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const page = Math.max(
      1,
      Math.min(100000, Math.trunc(Number(url.searchParams.get("page"))) || 1),
    );
    const where = {
      role: { in: ["member", "coach"] },
      ...(q ? { displayName: { contains: q } } : {}),
    };
    const [providers, users, total, actions] = await Promise.all([
      db.aiProvider.findMany({ orderBy: { createdAt: "asc" } }),
      db.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * 20,
        take: 20,
        select: {
          id: true,
          displayName: true,
          role: true,
          status: true,
          timezone: true,
          aiGrant: true,
        },
      }),
      db.user.count({ where }),
      db.aiAction.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          preview: true,
          status: true,
          createdAt: true,
          actor: { select: { displayName: true } },
        },
      }),
    ]);
    const usersWithUsage = await Promise.all(
      users.map(async (user) => {
        const [used, monthUsed] = await Promise.all([
          countAiQuotaUsage(user.id, user.timezone),
          countAiQuotaUsage(user.id, user.timezone, true),
        ]);
        return { ...user, used, monthUsed };
      }),
    );
    return NextResponse.json({
      ok: true,
      providers: providers.map(safeProvider),
      users: usersWithUsage,
      total,
      page,
      actions,
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}

/** Saving always probes the exact resulting URL/model/key, so stale tests cannot authorize a new destination. */
export async function PUT(req: Request) {
  try {
    await requireRole("admin");
    const parsed = providerInput.parse(await req.json());
    let input;
    try {
      input = normalizedInput(parsed);
    } catch {
      throw new AppError("validation", {
        userMessage: "آدرس اتصال معتبر نیست؛ یک آدرس عمومی HTTPS وارد کنید.",
      });
    }
    const existing = input.id
      ? await db.aiProvider.findUnique({ where: { id: input.id } })
      : null;
    if (input.id && !existing) throw new AppError("not_found");
    const encryptedKey = input.apiKey
      ? encryptProviderKey(input.apiKey)
      : existing?.encryptedKey;
    if (!encryptedKey)
      throw new AppError("validation", {
        userMessage: "کلید API را وارد کنید.",
      });
    const data = {
      label: input.label,
      kind: input.kind,
      baseUrl: input.baseUrl,
      model: input.model,
      encryptedKey,
      enabled: input.enabled,
      testedAt: new Date(),
    };
    try {
      await probeProvider(data);
    } catch {
      throw new AppError("provider", {
        userMessage:
          "آزمایش پاسخ و ابزارها موفق نبود. آدرس، کلید، مدل و پشتیبانی Function Calling را بررسی کنید. چیزی ذخیره نشد.",
      });
    }
    const provider = existing
      ? await db.aiProvider.update({ where: { id: existing.id }, data })
      : await db.aiProvider.create({ data });
    return NextResponse.json({
      ok: true,
      provider: safeProvider(provider),
      message: "اتصال و ابزارها آزمایش و ذخیره شد.",
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
export async function PATCH(req: Request) {
  try {
    await requireRole("admin");
    const data = grantInput.parse(await req.json());
    const user = await db.user.findFirst({
      where: { id: data.userId, role: { in: ["coach", "member"] } },
      select: { id: true },
    });
    if (
      !user ||
      !(await db.aiProvider.findUnique({
        where: { id: data.providerId },
        select: { id: true },
      }))
    )
      throw new AppError("not_found");
    const { userId, ...values } = data;
    const grant = await db.aiGrant.upsert({
      where: { userId },
      create: data,
      update: values,
    });
    return NextResponse.json({ ok: true, grant });
  } catch (error) {
    return appErrorResponse(error);
  }
}
export async function DELETE(req: Request) {
  try {
    await requireRole("admin");
    const { id } = z
      .object({ id: z.string().min(1) })
      .strict()
      .parse(await req.json());
    // Deactivate without erasing grants, credentials or accounting history.
    await db.aiProvider.update({ where: { id }, data: { enabled: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return appErrorResponse(error);
  }
}
