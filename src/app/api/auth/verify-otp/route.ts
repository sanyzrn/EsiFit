import { NextRequest, NextResponse } from "next/server";
import { verifyOtp } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toAppError } from "@/lib/errors/app-error";
import { createUserWithSeedHistory } from "@/lib/auth/provisioning";
import { z } from "zod";

const bodySchema = z.object({
  phone: z.string().min(4).max(20),
  code: z.string().min(4).max(10),
  deviceLabel: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const result = await verifyOtp(body.phone, body.code);

    // Create account on first successful verification.
    let user = await db.user.findUnique({ where: { phone: result.phone } });
    if (!user) {
      user = await createUserWithSeedHistory(result.phone);
    }

    const deviceLabel =
      body.deviceLabel ?? req.headers.get("user-agent")?.slice(0, 80) ?? "دستگاه ناشناس";
    await createSession(user.id, deviceLabel);

    const profile = await db.userProfile.findUnique({ where: { userId: user.id } });

    return NextResponse.json({
      ok: true,
      isNewUser: !profile?.onboardedAt,
      user: { id: user.id, displayName: user.displayName, tier: user.tier },
    });
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json(
      { ok: false, ...appError.toJSON() },
      { status: appError.code === "validation" ? 400 : appError.code === "rate_limit" ? 429 : 500 },
    );
  }
}
