"use client";

/**
 * Typed client fetch helper — maps AppError codes to Persian messages,
 * throws on !ok so callers can catch uniformly.
 */

export type ApiError = { code: string; message: string; status: number };

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response
  }
  const payload = data as { ok?: boolean; code?: string; message?: string } | null;
  if (!res.ok || payload?.ok === false) {
    const error: ApiError = {
      code: payload?.code ?? "network",
      message: payload?.message ?? "خطای غیرمنتظره. دوباره تلاش کنید.",
      status: res.status,
    };
    throw error;
  }
  return data as T;
}

export function isApiError(e: unknown): e is ApiError {
  return typeof e === "object" && e !== null && "code" in e && "message" in e;
}

export function errorMessage(e: unknown, fallback = "خطای غیرمنتظره. دوباره تلاش کنید."): string {
  if (isApiError(e)) return e.message;
  if (typeof navigator !== "undefined" && !navigator.onLine) return "شما آفلاین هستید — تغییرات محلی ذخیره شد.";
  return fallback;
}
