import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createUser, db, ensureSeed } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession } from "@/lib/auth/session";
import { GET as overview } from "@/app/api/gamification/overview/route";
import { POST as claim } from "@/app/api/gamification/claim/route";
import { POST as water } from "@/app/api/water/route";
import { POST as meal } from "@/app/api/nutrition/day/route";
import { POST as like } from "@/app/api/community/like/route";
import { GET as challenges, POST as join } from "@/app/api/community/challenges/route";
import { POST as sync } from "@/app/api/workouts/sync/route";
import { POST as complete } from "@/app/api/workouts/complete/route";
import { activityStreak, evaluateBadges } from "@/lib/domain/gamification-engine";
import { todayISO, addDaysISO, localDayStartUTC, weekStartISO } from "@/lib/dates/jalali";
import { BADGES } from "@/features/content/data/catalog";

const send = (path: string, body: unknown) => nextReq(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
let user: Awaited<ReturnType<typeof createUser>>;
let exerciseId: string;
beforeEach(async () => {
  await ensureSeed(); clearCookies();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
  user = await createUser("09121110801", { tier: "vip" }); await createSession(user.id, "phase4");
  exerciseId = (await db.exercise.findUniqueOrThrow({ where: { slug: "barbell-bench-press" } })).id;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
const day = (ago: number) => addDaysISO(todayISO(), -ago);
const at = (ago: number, hour = 10) => new Date(localDayStartUTC(day(ago)).getTime() + hour * 3600_000);
async function workout(ago: number, hour = 10, volume = 100) {
  return db.workoutSession.create({ data: { userId: user.id, status: "completed", startedAt: at(ago, hour), totalVolumeKg: volume,
    exerciseLogs: { create: { exerciseId, orderIndex: 0, sets: { create: { userId: user.id, setNumber: 1, reps: 10, weightKg: 10, completedAt: at(ago, hour) } } } } } });
}

describe("phase 4 engagement regressions", () => {
  it("F33/F44: incomplete competitions are unavailable by default at both API entry points", async () => {
    vi.stubEnv("ESIFIT_FLAG_CHALLENGES", "");
    const ch = await db.challenge.create({ data: { slug: "unfinished", nameFa: "تست", metric: "workouts", startDate: day(1), endDate: day(-5) } });
    expect((await (await challenges()).json()).challenges).toEqual([]);
    expect((await join(send("/api/community/challenges", { challengeId: ch.id }))).status).toBe(404);
    expect(await db.challengeParticipant.count()).toBe(0);
  });

  it("F36: water and nutrition badges unlock on their own events; early badge uses local time; retries award once", async () => {
    await db.badge.createMany({ data: BADGES.filter(b => ["water_days", "nutrition_days", "early"].includes(b.criteriaType)) });
    await db.userProfile.update({ where: { userId: user.id }, data: { dailyWaterTargetMl: 2000 } });
    const food = await db.food.create({ data: { slug: "phase4-food", nameFa: "تست", calories: 100, proteinG: 10, carbsG: 10, fatG: 2 } });
    for (let ago = 6; ago > 0; ago--) {
      await db.waterLog.create({ data: { userId: user.id, ml: 2000, logDate: day(ago), loggedAt: at(ago), clientId: `water-old-${ago}` } });
      await db.nutritionDay.create({ data: { userId: user.id, logDate: day(ago), entries: { create: { userId: user.id, foodId: food.id, mealSlot: "lunch", quantity: 1 } } } });
    }
    expect((await water(send("/api/water", { ml: 2000, clientId: "phase4-water" }))).status).toBe(200);
    expect(await db.userBadge.count({ where: { userId: user.id, badge: { slug: "hydration-hero" } } })).toBe(1);
    expect((await meal(send("/api/nutrition/day", { foodId: food.id, mealSlot: "lunch", clientId: "phase4-meal" }))).status).toBe(200);
    expect(await db.userBadge.count({ where: { userId: user.id, badge: { slug: "nutrition-week" } } })).toBe(1);
    await workout(0, 7); await Promise.all([evaluateBadges(user.id), evaluateBadges(user.id)]);
    await water(send("/api/water", { ml: 2000, clientId: "phase4-water" }));
    expect(await db.userBadge.count({ where: { userId: user.id } })).toBe(3);
    expect(await db.xpLog.count({ where: { userId: user.id, sourceType: "badge" } })).toBe(3);
    expect(await db.notification.count({ where: { userId: user.id, type: "achievement" } })).toBe(3);
  });

  it("F36/F38: achievements catch up historical activity and lifetime volume without a 60-session cap", async () => {
    await db.badge.createMany({ data: [
      { slug: "life-volume", nameFa: "حجم واقعی", descriptionFa: "تست", criteriaType: "volume", criteriaValue: 8000 },
      { slug: "long-streak", nameFa: "پیوستگی", descriptionFa: "تست", criteriaType: "streak", criteriaValue: 70 },
    ] });
    await Promise.all(Array.from({ length: 70 }, (_, ago) => workout(ago)));
    await Promise.all(Array.from({ length: 20 }, () => workout(0)));
    expect(await activityStreak(user.id)).toBe(70);
    const result = await (await overview()).json();
    expect(result.badges.filter((b: { earnedAt: string | null }) => b.earnedAt)).toHaveLength(2);
    await overview();
    expect(await db.xpLog.count({ where: { userId: user.id, sourceType: "badge" } })).toBe(2);
  });

  it("F38: a nutrition-only day contributes to the documented activity streak", async () => {
    const food = await db.food.create({ data: { slug: "nutrition-streak", nameFa: "تست", calories: 100, proteinG: 10, carbsG: 10, fatG: 2 } });
    for (const ago of [0, 1, 2]) await db.nutritionDay.create({ data: { userId: user.id, logDate: day(ago), entries: { create: { userId: user.id, foodId: food.id, mealSlot: "lunch", quantity: 1 } } } });
    expect(await activityStreak(user.id)).toBe(3);
  });

  it("F34/F45: old earned rewards stay visible and concurrent claims create one XP record and notification", async () => {
    const m = await db.mission.create({ data: { slug: "old-week", nameFa: "پاداش هفته", descriptionFa: "تست", criteriaType: "protein_hit", period: "weekly", target: 5, xpReward: 100 } });
    const periodKey = addDaysISO(weekStartISO(todayISO()), -7);
    await db.userMissionProgress.create({ data: { userId: user.id, missionId: m.id, periodKey, target: 5, progress: 5, completedAt: at(7) } });
    const state = await (await overview()).json();
    expect(state.missions.find((x: { id: string }) => x.id === m.id && (x as { isPast?: boolean }).isPast)).toMatchObject({ periodKey, progress: 5, isPast: true });
    const results = await Promise.all([claim(send("/api/gamification/claim", { missionId: m.id, periodKey })), claim(send("/api/gamification/claim", { missionId: m.id, periodKey }))]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await db.xpLog.count({ where: { userId: user.id, sourceType: "mission" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: user.id, type: "achievement" } })).toBe(1);
    const other = await createUser("09121110802"); clearCookies(); await createSession(other.id, "other");
    expect((await claim(send("/api/gamification/claim", { missionId: m.id, periodKey }))).status).toBe(404);
    expect((await claim(send("/api/gamification/claim", { missionId: m.id, periodKey: day(-10) }))).status).toBe(400);
  });

  it("F39/F43: likes respect the shared cap and water missions show partial progress against their own target", async () => {
    const post = await db.post.create({ data: { userId: user.id, content: "تست" } });
    await db.rateLimitBucket.create({ data: { key: createHash("sha256").update(`community:like:${user.id}`).digest("hex"), count: 60, resetAt: new Date(Date.now() + 60_000) } });
    expect((await like(send("/api/community/like", { postId: post.id, liked: true }))).status).toBe(429);
    expect(await db.postLike.count()).toBe(0);
    const m = await db.mission.create({ data: { slug: "daily-water", nameFa: "آب", descriptionFa: "تست", criteriaType: "water_ml", period: "daily", target: 500, xpReward: 30 } });
    await water(send("/api/water", { ml: 250, clientId: "partial-water" }));
    expect((await db.userMissionProgress.findFirstOrThrow({ where: { userId: user.id, missionId: m.id } })).progress).toBe(250);
    expect((await claim(send("/api/gamification/claim", { missionId: m.id }))).status).toBe(400);
  });

  it("F41/F42: clamps future set timestamps and blocks new late sets while acknowledging saved replays", async () => {
    const session = await db.workoutSession.create({ data: { userId: user.id, startedAt: at(0), status: "active" } });
    const set = { clientId: "future-set-1", sessionId: session.id, exerciseId, orderIndex: 0, setNumber: 1, reps: 8, weightKg: 20, completedAt: at(-365).toISOString() };
    expect((await (await sync(send("/api/workouts/sync", { sets: [set] }))).json()).synced).toBe(1);
    expect((await db.setLog.findFirstOrThrow({ where: { clientId: set.clientId } })).completedAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect((await complete(send("/api/workouts/complete", { sessionId: session.id }))).status).toBe(200);
    expect((await (await sync(send("/api/workouts/sync", { sets: [set] }))).json()).synced).toBe(1);
    expect((await (await sync(send("/api/workouts/sync", { sets: [{ ...set, clientId: "late-new-set", setNumber: 2 }] }))).json()).conflicts).toBe(1);
    expect((await db.workoutSession.findUniqueOrThrow({ where: { id: session.id } })).totalVolumeKg).toBe(160);
    expect(await db.setLog.count()).toBe(1);
  });
});
