import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  calculatorType: z.string().max(40),
  calculatorVersion: z.string().max(10).default("v1"),
  inputs: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()),
});

/** Save calculator result (member benefit). Anonymous calculation is always free. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ ok: false, code: "authentication", message: "برای ذخیره نتیجه وارد شوید." }, { status: 401 });
    }
    const body = schema.parse(await req.json());
    const created = await db.calculatorResult.create({
      data: {
        userId: session.id,
        calculatorType: body.calculatorType,
        calculatorVersion: body.calculatorVersion,
        inputsJson: JSON.stringify(body.inputs),
        resultJson: JSON.stringify(body.result),
      },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch {
    return NextResponse.json({ ok: false, code: "validation", message: "ذخیره ناموفق بود." }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: true, results: [] });
    const type = new URL(req.url).searchParams.get("type");
    const results = await db.calculatorResult.findMany({
      where: { userId: session.id, ...(type ? { calculatorType: type } : {}) },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({
      ok: true,
      results: results.map((r) => ({
        id: r.id,
        type: r.calculatorType,
        inputs: JSON.parse(r.inputsJson),
        result: JSON.parse(r.resultJson),
        createdAt: r.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, code: "unexpected" }, { status: 500 });
  }
}
