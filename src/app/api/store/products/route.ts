import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/commerce/catalog";
import { isMemberTier } from "@/lib/auth/access-policy";
import { appErrorResponse } from "@/lib/errors/respond";
export async function GET() {
  try {
    const session = await getSessionUser();
    const tier = session?.role === "member" && isMemberTier(session.tier) ? session.tier : "free";
    return NextResponse.json({ ok: true, ...await getCatalog(tier) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return appErrorResponse(error); }
}
