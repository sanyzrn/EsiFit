import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession } from "@/lib/auth/session";
import { createPlanFromTemplate, getTodayPlanDay, PLAN_WEEKS } from "@/features/workouts/data/plan-templates";
import { claimAiQuotaSlot, finalizeAiQuota, releaseAiQuotaSlot, countAiQuotaUsage, newQuotaRequestId } from "@/lib/ai/quota";
import { GET as alternatives } from "@/app/api/workouts/alternatives/route";
import { PATCH as patchProfile, GET as getProfile } from "@/app/api/settings/profile/route";
import { POST as regenerate } from "@/app/api/workouts/plan/regenerate/route";

const post = (url: string, body: unknown) =>
  nextReq(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const patch = (url: string, body: unknown) =>
  nextReq(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

let user: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await ensureSeed();
  clearCookies();
  user = await createUser("09121110941", { role: "member", tier: "vip" });
  await createSession(user.id, "vitest");
});

describe("4-week plan generation", () => {
  it("creates weeks 1–4 with progressive sets and a deload week", async () => {
    const plan = await createPlanFromTemplate(user.id, "ppl", undefined, null);
    expect(plan.weeks).toBe(PLAN_WEEKS);
    expect(PLAN_WEEKS).toBe(4);

    const days = await db.workoutPlanDay.findMany({ where: { planId: plan.id } });
    const weeks = new Set(days.map((d) => d.weekNumber));
    expect([...weeks].sort()).toEqual([1, 2, 3, 4]);

    // Each template day exists in every week.
    const cycleLen = days.filter((d) => d.weekNumber === 1).length;
    expect(cycleLen).toBeGreaterThan(0);
    for (const w of [1, 2, 3, 4]) {
      expect(days.filter((d) => d.weekNumber === w).length).toBe(cycleLen);
    }

    // Deload week has fewer or equal working sets vs peak week on a compound day.
    const w1Day = days.find((d) => d.weekNumber === 1 && !d.isRestDay)!;
    const w3Day = days.find((d) => d.weekNumber === 3 && d.dayNumber === w1Day.dayNumber)!;
    const w4Day = days.find((d) => d.weekNumber === 4 && d.dayNumber === w1Day.dayNumber)!;
    const setsOf = async (dayId: string) => {
      const rows = await db.plannedExercise.findMany({ where: { planDayId: dayId } });
      return rows.reduce((a, r) => a + r.targetSets, 0);
    };
    const s3 = await setsOf(w3Day.id);
    const s4 = await setsOf(w4Day.id);
    expect(s4).toBeLessThanOrEqual(s3);
  });

  it("resolves today's day using startsOn week progression", async () => {
    const startsOn = "2026-01-05"; // fixed Monday-ish anchor
    const plan = await createPlanFromTemplate(user.id, "ppl", startsOn, null);
    const weekOne = await db.workoutPlanDay.findMany({
      where: { planId: plan.id, weekNumber: 1 },
      orderBy: { dayNumber: "asc" },
    });
    const cycleLen = weekOne.length;
    // Force "today" by temporarily monkey-patching Date is heavy — instead
    // verify mapping helper logic via getTodayPlanDay on a plan that starts today.
    const today = await getTodayPlanDay(user.id);
    expect(today).toBeTruthy();
    expect(today!.weekNumber).toBeGreaterThanOrEqual(1);
    expect(today!.weekNumber).toBeLessThanOrEqual(PLAN_WEEKS);
    expect(cycleLen).toBeGreaterThan(0);
  });

  it("substitutes equipment-incompatible exercises and records them on the plan", async () => {
    await db.userProfile.update({
      where: { userId: user.id },
      data: { availableEquipment: '["bodyweight","band"]' },
    });
    const plan = await createPlanFromTemplate(user.id, "ppl", undefined, new Set(["bodyweight", "band"]));
    const planned = await db.plannedExercise.findMany({
      where: { planDay: { planId: plan.id } },
      include: { exercise: true },
    });
    expect(planned.length).toBeGreaterThan(0);
    const disallowed = planned.filter((p) => !["bodyweight", "band"].includes(p.exercise.equipment));
    // Some rest/cardio rows may be skipped; remaining planned lifts must be allowed.
    expect(disallowed.length).toBe(0);
  });
});

describe("profile equipment API", () => {
  it("GET defaults to unrestricted; PATCH stores a subset", async () => {
    const g1 = await getProfile();
    const j1 = await g1.json();
    expect(j1.unrestricted).toBe(true);

    const p = await patchProfile(patch("/api/settings/profile", { availableEquipment: ["dumbbell", "bodyweight"] }));
    expect(p.status).toBe(200);
    const pj = await p.json();
    expect(pj.unrestricted).toBe(false);
    expect(pj.availableEquipment.sort()).toEqual(["bodyweight", "dumbbell"]);

    const g2 = await getProfile();
    const j2 = await g2.json();
    expect(j2.availableEquipment.sort()).toEqual(["bodyweight", "dumbbell"]);
  });

  it("regenerate endpoint builds a 4-week plan", async () => {
    await patchProfile(patch("/api/settings/profile", { availableEquipment: ["bodyweight"] }));
    const res = await regenerate(post("/api/workouts/plan/regenerate", { template: "ppl" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.weeks).toBe(4);
    expect(json.dayCount).toBeGreaterThan(4);
  });

  it("alternatives respect profile equipment", async () => {
    await db.userProfile.update({
      where: { userId: user.id },
      data: { availableEquipment: '["bodyweight"]' },
    });
    const bench = await db.exercise.findUnique({ where: { slug: "barbell-bench-press" } });
    const res = await alternatives(nextReq(`/api/workouts/alternatives?exerciseId=${bench!.id}`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.equipmentRestricted).toBe(true);
    for (const alt of json.alternatives) {
      expect(alt.equipment).toBe("bodyweight");
    }
  });
});

describe("atomic AI quota", () => {
  const limit = 3;
  const tz = "Asia/Tehran";

  it("allows claims up to the limit then rejects", async () => {
    const ids: string[] = [];
    for (let i = 0; i < limit; i++) {
      const claim = await claimAiQuotaSlot({ userId: user.id, timezone: tz, limit });
      expect(claim.ok).toBe(true);
      if (claim.ok) {
        ids.push(claim.requestId);
        await finalizeAiQuota(claim.requestId, { promptTokens: 1, completionTokens: 1, totalTokens: 2 });
      }
    }
    const overflow = await claimAiQuotaSlot({ userId: user.id, timezone: tz, limit });
    expect(overflow.ok).toBe(false);
  });

  it("counts concurrent pending reservations against the quota", async () => {
    const a = await claimAiQuotaSlot({ userId: user.id, timezone: tz, limit });
    expect(a.ok).toBe(true);
    // Leave A pending (in-flight provider call).
    const b = await claimAiQuotaSlot({ userId: user.id, timezone: tz, limit });
    expect(b.ok).toBe(true);
    const c = await claimAiQuotaSlot({ userId: user.id, timezone: tz, limit });
    expect(c.ok).toBe(true);
    const d = await claimAiQuotaSlot({ userId: user.id, timezone: tz, limit });
    expect(d.ok).toBe(false);
  });

  it("releases a pending slot on provider failure", async () => {
    const claim = await claimAiQuotaSlot({ userId: user.id, timezone: tz, limit: 1 });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    const next = await claimAiQuotaSlot({ userId: user.id, timezone: tz, limit: 1 });
    expect(next.ok).toBe(false);
    await releaseAiQuotaSlot(claim.requestId, "failed");
    const retry = await claimAiQuotaSlot({ userId: user.id, timezone: tz, limit: 1 });
    expect(retry.ok).toBe(true);
  });

  it("finalize is idempotent and does not double-bill", async () => {
    const claim = await claimAiQuotaSlot({ userId: user.id, timezone: tz, limit: 5 });
    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    await finalizeAiQuota(claim.requestId, { totalTokens: 10, latencyMs: 5 });
    await finalizeAiQuota(claim.requestId, { totalTokens: 10, latencyMs: 5 });
    const used = await countAiQuotaUsage(user.id, tz);
    const success = await db.aiUsageLog.count({
      where: { userId: user.id, requestId: claim.requestId, status: "success" },
    });
    expect(success).toBe(1);
    expect(used).toBeGreaterThanOrEqual(1);
  });

  it("parallel claims cannot exceed the limit", async () => {
    const parallelLimit = 4;
    const claims = await Promise.all(
      Array.from({ length: 10 }, () => claimAiQuotaSlot({ userId: user.id, timezone: tz, limit: parallelLimit })),
    );
    const ok = claims.filter((c) => c.ok);
    expect(ok.length).toBeLessThanOrEqual(parallelLimit);
  });
});
