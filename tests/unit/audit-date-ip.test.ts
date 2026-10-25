import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidISODate, weekStartISO } from "@/lib/dates/jalali";
import { clientIp } from "@/lib/http/client-ip";

afterEach(() => vi.unstubAllEnvs());
describe("audit date and proxy boundaries", () => {
  it("validates actual Gregorian calendar dates", () => {
    for (const date of ["2026-13-01", "2026-02-29", "2026-02-30", "2026-00-01", "2026-1-01"]) expect(isValidISODate(date)).toBe(false);
    for (const date of ["2024-02-29", "2026-10-25"]) expect(isValidISODate(date)).toBe(true);
    expect(weekStartISO("2026-10-25")).toBe("2026-10-24");
  });
  it("uses only the trusted platform source, never client-supplied cf-connecting-ip", () => {
    vi.stubEnv("VERCEL", "1");
    const req = new Request("http://localhost", { headers: { "x-vercel-forwarded-for": "1.1.1.1", "x-real-ip": "8.8.8.8", "cf-connecting-ip": "9.9.9.9" } });
    expect(clientIp(req)).toBe("1.1.1.1");
    vi.stubEnv("VERCEL", "0"); vi.stubEnv("TRUST_PROXY", "false");
    expect(clientIp(req)).toBeNull();
    vi.stubEnv("TRUST_PROXY", "true");
    expect(clientIp(new Request("http://localhost", { headers: { "x-forwarded-for": "8.8.8.8, 1.1.1.1" } }))).toBe("1.1.1.1");
    expect(clientIp(new Request("http://localhost", { headers: { "x-forwarded-for": "garbage" } }))).toBeNull();
  });
});
