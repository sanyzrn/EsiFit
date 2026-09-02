import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";

import { POST as requestOtpPost } from "@/app/api/auth/request-otp/route";
import { POST as verifyOtpPost } from "@/app/api/auth/verify-otp/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { createSession, getSessionUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/session";

const post = (url: string, body: unknown) =>
  nextReq(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(async () => {
  await ensureSeed();
  clearCookies();
});

describe("OTP authentication flow", () => {
  it("request-otp returns a dev code and creates a stored hash", async () => {
    const res = await requestOtpPost(post("/api/auth/request-otp", { phone: "09121110001" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.devCode).toMatch(/^\d{6}$/);
    const stored = await db.otpCode.findFirst({ where: { phone: "09121110001" } });
    expect(stored).toBeTruthy();
    // Code is HMAC-hashed, never stored raw.
    expect(stored!.codeHash).not.toBe(json.devCode);
  });

  it("normalizeIranMobile guards before storing", async () => {
    const res = await requestOtpPost(post("/api/auth/request-otp", { phone: "123" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("verify-otp creates a new account on first login and sets a session", async () => {
    const r1 = await requestOtpPost(post("/api/auth/request-otp", { phone: "09121110999" }));
    const { devCode } = await r1.json();

    const res = await verifyOtpPost(post("/api/auth/verify-otp", { phone: "09121110999", code: devCode }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.isNewUser).toBe(true);
    expect(json.user.displayName).toBeTruthy();

    // Session cookie is set and getSessionUser resolves.
    const sessionUser = await getSessionUser();
    expect(sessionUser).toBeTruthy();
    expect(sessionUser!.phone).toBe("09121110999");
    expect(sessionUser!.role).toBe("member");
  });

  it("verify-otp rejects wrong codes with attempts cap intact", async () => {
    const r1 = await requestOtpPost(post("/api/auth/request-otp", { phone: "09121110998" }));
    const { devCode } = await r1.json();
    const bad = await verifyOtpPost(post("/api/auth/verify-otp", { phone: "09121110998", code: "000000" }));
    expect(bad.status).toBe(400);
    const good = await verifyOtpPost(post("/api/auth/verify-otp", { phone: "09121110998", code: devCode }));
    expect(good.status).toBe(200);
  });

  it("logout revokes the session", async () => {
    const user = await createUser("09121110997");
    await createSession(user.id, "vitest");
    expect(await getSessionUser()).toBeTruthy();
    await logout();
    expect(await getSessionUser()).toBeNull();
  });

  it("me returns null for anonymous", async () => {
    const res = await me();
    const json = await res.json();
    expect(json.user).toBeNull();
  });
});

describe("role authorization", () => {
  it("requireRole throws 401 unauthenticated and 403 for wrong role", async () => {
    await expect(requireRole("coach_or_admin")).rejects.toMatchObject({ code: "authentication" });

    const member = await createUser("09121110996", { role: "member" });
    await createSession(member.id, "vitest");
    await expect(requireRole("coach_or_admin")).rejects.toMatchObject({ code: "authorization" });
  });

  it("coach passes coach gate; admin passes everything", async () => {
    const coach = await createUser("09121110995", { role: "coach", tier: "coach" });
    await createSession(coach.id, "vitest");
    await expect(requireRole("coach_or_admin")).resolves.toMatchObject({ role: "coach" });
    clearCookies();

    const admin = await createUser("09121110994", { role: "admin", tier: "vip_plus" });
    await createSession(admin.id, "vitest");
    await expect(requireRole("admin")).resolves.toMatchObject({ role: "admin" });
    await expect(requireRole("coach_or_admin")).resolves.toMatchObject({ role: "admin" });
  });
});
