import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Health probe — used by monitoring and the sandbox gateway. */
export async function GET() {
  let database = "down";
  try {
    await db.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }
  return NextResponse.json({
    ok: true,
    service: "esifit",
    status: database === "up" ? "healthy" : "degraded",
    database,
    time: new Date().toISOString(),
  });
}
