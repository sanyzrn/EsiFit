import { NextResponse } from "next/server";
import { toAppError } from "@/lib/errors/app-error";

/** Canonical AppErrorCode → HTTP status mapping (single source for all routes). */
const STATUS_BY_CODE: Record<string, number> = {
  validation: 400,
  authentication: 401,
  authorization: 403,
  not_found: 404,
  conflict: 409,
  rate_limit: 429,
  quota: 402,
  network: 503,
  provider: 502,
  unexpected: 500,
};

export function httpStatusForCode(code: string): number {
  return STATUS_BY_CODE[code] ?? 500;
}

/** Uniform error response for every API route. Unexpected errors are logged for ops. */
export function appErrorResponse(error: unknown) {
  const appError = toAppError(error);
  if (appError.code === "unexpected") {
    console.error("[api] unexpected error:", error);
  }
  return NextResponse.json({ ok: false, ...appError.toJSON() }, { status: httpStatusForCode(appError.code) });
}
