import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/lib/auth/session";
import { appErrorResponse } from "@/lib/errors/respond";

export async function POST() {
  try {
    await destroyCurrentSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return appErrorResponse(error);
  }
}
