import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { getAiAccess } from "@/lib/ai/access";
import { executeAction } from "@/lib/ai/actions";
import { AppError } from "@/lib/errors/app-error";
import { appErrorResponse } from "@/lib/errors/respond";
export async function POST(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor) throw new AppError("authentication");
    await getAiAccess(actor);
    const { id, confirm } = z
      .object({ id: z.string().min(1), confirm: z.boolean() })
      .strict()
      .parse(await req.json());
    return NextResponse.json({
      ok: true,
      action: await executeAction(actor, id, confirm),
    });
  } catch (error) {
    return appErrorResponse(error);
  }
}
