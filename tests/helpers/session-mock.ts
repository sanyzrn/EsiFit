import "./../setup-env";
import { vi } from "vitest";

/**
 * Mock next/headers cookies() with an in-memory store so route handlers
 * (which use session.ts → cookies()) can be tested without a server.
 */
type CookieRecord = { name: string; value: string; expires?: Date };

const store = new Map<string, CookieRecord>();

const cookieJar = {
  get: (name: string) => store.get(name),
  // Next 15/16 supports both set(rec) and set(name, value, options).
  set: (nameOrRec: string | CookieRecord, value?: string, options?: Record<string, unknown>) => {
    if (typeof nameOrRec === "string") {
      const rec: CookieRecord = {
        name: nameOrRec,
        value: value ?? "",
        expires: (options?.expires as Date | undefined) ?? undefined,
      };
      store.set(rec.name, rec);
    } else {
      store.set(nameOrRec.name, nameOrRec);
    }
  },
  delete: (name: string) => store.delete(name),
  getAll: () => [...store.values()],
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieJar),
}));

/** Clear the fake cookie jar between test cases. */
export function clearCookies() {
  store.clear();
}

/** Current session cookie value (raw.jwt), if any. */
export function currentSessionCookie(): string | undefined {
  return store.get("esifit_session")?.value;
}
