import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession } from "@/lib/auth/session";
import { createPlanFromTemplate, getTodayPlanDay } from "@/features/workouts/data/plan-templates";
import { POST as water } from "@/app/api/water/route";
import { GET as notifications } from "@/app/api/notifications/route";
import { POST as checkout } from "@/app/api/store/checkout/route";

const post = (url: string, body: unknown) =>
  nextReq(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

let user: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await ensureSeed();
  clearCookies();
  user = await createUser("09121110977", { role: "member", tier: "free" });
  await createSession(user.id, "vitest");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("plan day follows the user's local calendar day", () => {
  it("00:30 Tehran is still the new local day even though UTC says yesterday", async () => {
    // 2026-03-10 21:00 UTC == 2026-03-11 00:30 in Asia/Tehran (UTC+3:30, no DST in 2026).
    const plan = await createPlanFromTemplate(user.id, "ppl", "2026-03-10", null);
    const days = await db.workoutPlanDay.findMany({ where: { planId: plan.id, weekNumber: 1 }, orderBy: { dayNumber: "asc" } });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-10T21:00:00Z"));
    const day = await getTodayPlanDay(user.id, "Asia/Tehran");
    // One local day after startsOn → second day of the cycle, not the first.
    expect(day?.weekNumber).toBe(1);
    expect(day?.dayNumber).toBe(days.length > 1 ? 2 : 1);
  });
});

describe("offline water replay", () => {
  it("buckets an entry by when it was logged, not when the queue flushed", async () => {
    const loggedAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const res = await water(post("/api/water", { ml: 250, clientId: "water-audit-1", loggedAt }));
    expect(res.status).toBe(200);
    const row = await db.waterLog.findFirstOrThrow({ where: { userId: user.id, clientId: "water-audit-1" } });
    expect(row.logDate).toBe(new Intl.DateTimeFormat("en-CA", { timeZone: user.timezone }).format(new Date(loggedAt)));
  });

  it("never lets a client-claimed future timestamp land in a future day", async () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    await water(post("/api/water", { ml: 250, clientId: "water-audit-2", loggedAt: future }));
    const row = await db.waterLog.findFirstOrThrow({ where: { userId: user.id, clientId: "water-audit-2" } });
    expect(row.loggedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("notifications", () => {
  it("reports the true unread total, not just unread among the latest 40", async () => {
    await db.notification.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        userId: user.id, type: "system", title: `n${i}`, body: "x", createdAt: new Date(Date.now() - i * 1000),
      })),
    });
    const res = await notifications();
    const json = await res.json();
    expect(json.notifications).toHaveLength(40);
    expect(json.unread).toBe(55);
  });
});

describe("mock payments are sandbox-only", () => {
  it("store checkout refuses to mint paid orders in production without the opt-in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await checkout(post("/api/store/checkout", { items: [{ productId: "nope", qty: 1 }] }));
    expect(res.status).toBe(502);
    expect(await db.order.count({ where: { userId: user.id } })).toBe(0);
  });
});
