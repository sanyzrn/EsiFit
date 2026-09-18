import { NextRequest, NextResponse } from "next/server";
import { requestOtp } from "@/lib/auth/otp";
import { appErrorResponse } from "@/lib/errors/respond";
import { z } from "zod";

const bodySchema = z.object({ phone: z.string().min(4).max(20) });

/** Prefer proxy-set trusted IPs; leftmost X-Forwarded-For is client-spoofable. */
function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    null
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const result = await requestOtp(body.phone, clientIp(req));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return appErrorResponse(error);
  }
}
