import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession } from "@/lib/auth/session";
import { POST as startSession } from "@/app/api/workouts/sessions/route";
import { POST as syncSets } from "@/app/api/workouts/sync/route";
import { POST as complete } from "@/app/api/workouts/complete/route";
import { POST as addMeal } from "@/app/api/nutrition/day/route";
import { GET as getNutritionDay } from "@/app/api/nutrition/day/route";
import { POST as addWater } from "@/app/api/water/route";
import { GET as communityFeed } from "@/app/api/community/feed/route";
import { POST as createPost } from "@/app/api/community/feed/route";
import { GET as analyticsOverview } from "@/app/api/analytics/overview/route";
import { POST as subscribe } from "@/app/api/plans/subscribe/route";
import { normalizeIranMobile } from "@/lib/auth/otp";

const post = (url: string, body: unknown) =>
  nextReq(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

let user: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await ensureSeed();
  clearCookies();
  user = await createUser("09121110981", { role: "member", tier: "vip" });
  await createSession(user.id, "vitest");
});

describe("PR history holds multiple demotions", () => {
  it("allows a second PR demotion without unique-constraint failure", async () => {
    const bench = await db.exercise.findUnique({ where: { slug: "barbell-bench-press" } });
    expect(bench).toBeTruthy();

    // Two historical PRs already demoted (previously impossible).
    await db.personalRecord.create({
      data: { userId: user.id, exerciseId: bench!.id, recordType: "weight", value: 60, unit: "kg", achievedAt: new Date(Date.now() - 90 * 86400000), isCurrent: false },
    });
    await db.personalRecord.create({
      data: { userId: user.id, exerciseId: bench!.id, recordType: "weight", value: 70, unit: "kg", achievedAt: new Date(Date.now() - 30 * 86400000), isCurrent: true },
    });

    const start = await startSession(post("/api/workouts/sessions", {}));
    const { session } = await start.json();
    await syncSets(post("/api/workouts/sync", {
      sets: [{
        clientId: "pr-multi-1", sessionId: session.id, exerciseId: bench!.id,
        orderIndex: 0, setNumber: 1, weightKg: 80, reps: 3, completedAt: new Date().toISOString(),
      }],
    }));

    const done = await complete(post("/api/workouts/complete", { sessionId: session.id, durationSeconds: 1800 }));
    expect(done.status).toBe(200);
    const json = await done.json();
    expect(json.ok).toBe(true);
    expect(json.summary.prs.length).toBe(1);

    const history = await db.personalRecord.findMany({
      where: { userId: user.id, exerciseId: bench!.id, recordType: "weight" },
    });
    const currents = history.filter((r) => r.isCurrent);
    expect(currents).toHaveLength(1);
    expect(history.length).toBeGreaterThanOrEqual(3); // 2 demoted + 1 current
    expect(currents[0].value).toBeGreaterThan(70);
  });
});

describe("nutrition macros are not squared", () => {
  it("stores servingMultiplier=1 so quantity multiplies macros once", async () => {
    const food = await db.food.create({
      data: {
        slug: "test-chicken", nameFa: "مرغ تست", category: "protein",
        servingAmount: 100, servingUnit: "گرم",
        calories: 200, proteinG: 30, carbsG: 0, fatG: 5,
      },
    });

    const res = await addMeal(post("/api/nutrition/day", {
      foodId: food.id, mealSlot: "lunch", quantity: 2, clientId: "meal-test-001",
    }));
    expect(res.status).toBe(200);

    const entry = await db.mealEntry.findFirst({ where: { clientId: "meal-test-001" } });
    expect(entry).toBeTruthy();
    expect(entry!.servingMultiplier).toBe(1);
    expect(entry!.quantity).toBe(2);

    const day = await getNutritionDay(nextReq("/api/nutrition/day"));
    const json = await day.json();
    // 2 servings × 200 kcal = 400 (not 2²×200=800)
    expect(json.totals.calories).toBe(400);
    expect(json.totals.proteinG).toBe(60);
  });
});

describe("clientId is scoped per user", () => {
  it("water replay from another user does not falsely succeed as duplicate", async () => {
    const clientId = "water-shared-id-1";
    const own = await addWater(post("/api/water", { ml: 500, clientId }));
    expect(own.status).toBe(200);
    const ownJson = await own.json();
    expect(ownJson.ok).toBe(true);

    clearCookies();
    const stranger = await createUser("09121110982");
    await createSession(stranger.id, "vitest");
    const foreign = await addWater(post("/api/water", { ml: 500, clientId }));
    const foreignJson = await foreign.json();
    // Same clientId from a different user must create their own row, not
    // treat another user's id as "already done".
    expect(foreignJson.ok).toBe(true);
    expect(foreignJson.duplicate).toBeUndefined();
    const rows = await db.waterLog.count({ where: { clientId } });
    expect(rows).toBe(2);
  });

  it("set log clientId collisions across users do not silently drop data", async () => {
    const start = await startSession(post("/api/workouts/sessions", {}));
    const { session } = await start.json();
    const bench = await db.exercise.findUnique({ where: { slug: "barbell-bench-press" } });
    const setId = "set-shared-id-001";
    await syncSets(post("/api/workouts/sync", {
      sets: [{
        clientId: setId, sessionId: session.id, exerciseId: bench!.id,
        orderIndex: 0, setNumber: 1, weightKg: 50, reps: 5, completedAt: new Date().toISOString(),
      }],
    }));

    clearCookies();
    const stranger = await createUser("09121110983");
    await createSession(stranger.id, "vitest");
    const strangerStart = await startSession(post("/api/workouts/sessions", {}));
    const { session: strangerSession } = await strangerStart.json();
    const foreign = await syncSets(post("/api/workouts/sync", {
      sets: [{
        clientId: setId, sessionId: strangerSession.id, exerciseId: bench!.id,
        orderIndex: 0, setNumber: 1, weightKg: 60, reps: 5, completedAt: new Date().toISOString(),
      }],
    }));
    const foreignJson = await foreign.json();
    expect(foreignJson.synced).toBe(1);
    const rows = await db.setLog.count({ where: { clientId: setId } });
    expect(rows).toBe(2);
  });
});

describe("community feed visibility", () => {
  it("never returns non-public posts in the public feed", async () => {
    await createPost(post("/api/community/feed", { content: "پست عمومی تستی برای فید" }));
    clearCookies();
    // Seed a private post directly (not via public API).
    await db.post.create({
      data: { userId: user.id, content: "پست خصوصی نباید دیده شود", visibility: "private" },
    });

    const feed = await communityFeed(nextReq("/api/community/feed"));
    const json = await feed.json();
    const contents = json.posts.map((p: { content: string }) => p.content);
    expect(contents).toContain("پست عمومی تستی برای فید");
    expect(contents).not.toContain("پست خصوصی نباید دیده شود");
  });
});

describe("analytics entitlement is server-enforced", () => {
  it("free tier does not receive advanced analytics payloads", async () => {
    clearCookies();
    const free = await createUser("09121110984", { role: "member", tier: "free" });
    await createSession(free.id, "vitest");

    const res = await analyticsOverview(nextReq("/api/analytics/overview"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.entitlements.advancedAnalytics).toBe(false);
    expect(json.esiScore).toBeNull();
    expect(json.strengthTrend).toEqual([]);
    expect(json.insights).toEqual([]);
  });

  it("vip tier receives advanced analytics payloads", async () => {
    const res = await analyticsOverview(nextReq("/api/analytics/overview"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.entitlements.advancedAnalytics).toBe(true);
    // esiScore object present (may still be computed even with empty history)
    expect(json.esiScore === null || typeof json.esiScore === "object").toBe(true);
  });
});

describe("subscription sandbox gate", () => {
  it("sandbox (non-production) still upgrades tier via mock payment", async () => {
    const plan = await db.subscriptionPlan.findFirst({ where: { code: "vip_monthly" } })
      ?? await db.subscriptionPlan.create({
        data: {
          code: "vip_monthly", tier: "vip", nameFa: "وی‌آی‌پی ماهانه",
          billingPeriod: "monthly", priceToman: 99000, featuresFa: "[]",
        },
      });

    const res = await subscribe(post("/api/plans/subscribe", { planCode: plan.code }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tier).toBe("vip");
    const updated = await db.user.findUnique({ where: { id: user.id } });
    expect(updated!.tier).toBe("vip");
  });
});

describe("OTP phone normalization", () => {
  it("accepts +98 / 0098 / 9xx forms and rejects garbage", () => {
    expect(normalizeIranMobile("09120000000")).toBe("09120000000");
    expect(normalizeIranMobile("+989120000000")).toBe("09120000000");
    expect(normalizeIranMobile("00989120000000")).toBe("09120000000");
    expect(normalizeIranMobile("9120000000")).toBe("09120000000");
    expect(normalizeIranMobile("۰۹۱۲۰۰۰۰۰۰۰")).toBe("09120000000");
    expect(normalizeIranMobile("12345")).toBeNull();
    expect(normalizeIranMobile("08120000000")).toBeNull();
  });
});

describe("store checkout enforces stock", () => {
  it("rejects checkout when stock is insufficient", async () => {
    const product = await db.product.create({
      data: {
        slug: `test-band-${Date.now()}`, nameFa: "باند تست", type: "physical",
        priceToman: 100000, stock: 1, status: "active",
      },
    });
    const { POST: checkout } = await import("@/app/api/store/checkout/route");
    const res = await checkout(post("/api/store/checkout", {
      items: [{ productId: product.id, qty: 2 }],
    }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.ok).toBe(false);

    const still = await db.product.findUnique({ where: { id: product.id } });
    expect(still!.stock).toBe(1);
  });

  it("decrements stock on successful checkout", async () => {
    const product = await db.product.create({
      data: {
        slug: `test-shaker-${Date.now()}`, nameFa: "شیکر تست", type: "physical",
        priceToman: 80000, stock: 5, status: "active",
      },
    });
    const { POST: checkout } = await import("@/app/api/store/checkout/route");
    const res = await checkout(post("/api/store/checkout", {
      items: [{ productId: product.id, qty: 2 }],
    }));
    expect(res.status).toBe(200);
    const after = await db.product.findUnique({ where: { id: product.id } });
    expect(after!.stock).toBe(3);
  });
});

describe("icon registry covers used names", () => {
  it("resolves every static Icon name used in the app", async () => {
    const { USED_ICON_NAMES } = await import("../helpers/icon-registry");
    const { ICON_REGISTRY_KEYS } = await import("@/components/ui/icon");
    const known = new Set<string>(ICON_REGISTRY_KEYS);
    const missing = USED_ICON_NAMES.filter((n) => !known.has(n));
    expect(missing).toEqual([]);
  });
});
