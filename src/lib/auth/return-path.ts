/** Internal destinations only; normalized auth/API loops and external URLs fail closed. */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\x00-\x20\x7f]/.test(decoded) || /%[0-9a-f]{2}/i.test(decoded)) return null;
  const url = new URL(decoded, "https://esifit.invalid");
  if (url.origin !== "https://esifit.invalid" || url.pathname.startsWith("//") || /^\/(?:auth|api)(?:\/|$)/.test(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
export function loginPath(next: unknown): string {
  const path = safeReturnPath(next); return path ? `/auth/login?next=${encodeURIComponent(path)}` : "/auth/login";
}
export function onboardingPath(next: unknown): string {
  const path = safeReturnPath(next); return path ? `/auth/onboarding?next=${encodeURIComponent(path)}` : "/auth/onboarding";
}
