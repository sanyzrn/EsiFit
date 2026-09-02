import { NextRequest, NextResponse } from "next/server";
import { requestOtp } from "@/lib/auth/otp";
import { appErrorResponse } from "@/lib/errors/respond";
import { z } from "zod";

const bodySchema = z.object({ phone: z.string().min(4).max(20) });

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const result = await requestOtp(body.phone, ip);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return appErrorResponse(error);
  }
}
