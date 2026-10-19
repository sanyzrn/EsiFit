"use client";

/**
 * Typed client fetch helper — maps AppError codes to Persian messages,
 * throws on !ok so callers can catch uniformly.
 */

export type ApiError = { code: string; message: string; status: number };

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  } catch {
    // fetch only rejects when the request never reached a server (offline, DNS, abort).
    const error: ApiError = {
      code: "network",
      message: "اتصال برقرار نشد. اینترنت خود را بررسی کنید.",
      status: 0,
    };
    throw error;
  }
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
  if (isApiError(e)) {
    if (e.code === "network" && typeof navigator !== "undefined" && !navigator.onLine) {
      return "شما آفلاین هستید — تغییرات محلی ذخیره شد.";
    }
    return e.message;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) return "شما آفلاین هستید — تغییرات محلی ذخیره شد.";
  return fallback;
}
