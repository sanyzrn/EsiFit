import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession, getSessionUser } from "@/lib/auth/session";
import { POST as sync } from "@/app/api/workouts/sync/route";
import { POST as complete } from "@/app/api/workouts/complete/route";
import { POST as swap } from "@/app/api/workouts/swap/route";
import { GET as analytics } from "@/app/api/analytics/overview/route";
import { GET as foods } from "@/app/api/nutrition/foods/route";
import { POST as addMeal, DELETE as deleteMeal } from "@/app/api/nutrition/day/route";
import { POST as createGoal } from "@/app/api/goals/route";
import { PATCH as editGoal } from "@/app/api/goals/[id]/route";
import { GET as athleteDetail } from "@/app/api/coach/athlete/[id]/route";
import { DELETE as moderate } from "@/app/api/admin/moderation/route";
import { POST as assignPlan } from "@/app/api/coach/assign/route";
import { getAiAccess } from "@/lib/ai/access";
import { encryptProviderKey } from "@/lib/ai/secrets";
import { rateLimit } from "@/lib/http/rate-limit";
import { todayISO, addDaysISO, localDayStartUTC, localDayEndUTC, weekStartISO } from "@/lib/dates/jalali";
import { getCoachAthleteDetail } from "@/lib/coach/data";
import { refreshDerivedMissions, claimMission } from "@/lib/domain/gamification-engine";
import { createPlanFromTemplate } from "@/features/workouts/data/plan-templates";

const req = (url: string, body: unknown, method = "POST") => nextReq(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
let user: Awaited<ReturnType<typeof createUser>>;
beforeEach(async () => { await ensureSeed(); clearCookies(); user = await createUser("09121110001", { tier: "vip" }); await createSession(user.id, "audit"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function active() { return db.workoutSession.create({ data: { userId: user.id, status: "active", startedAt: new Date() } }); }
async function bench() { return db.exercise.findUniqueOrThrow({ where: { slug: "barbell-bench-press" } }); }
async function syncOne(id: string, options: Record<string, unknown> = {}) {
  return sync(req("/api/workouts/sync", { sets: [{ clientId: "audit-set-1", sessionId: id, exerciseId: (await bench()).id, orderIndex: 0, setNumber: 1, reps: 5, weightKg: 60, ...options }] }));
}

describe("verified audit regressions", () => {
  it("F15/F17: empty and warmup-only sessions cannot earn XP, bodyweight can", async () => {
    const s = await active();
    expect((await complete(req("/api/workouts/complete", { sessionId: s.id }))).status).toBe(400);
    await syncOne(s.id, { isWarmup: true });
    expect((await complete(req("/api/workouts/complete", { sessionId: s.id }))).status).toBe(400);
    expect(await db.xpLog.count()).toBe(0);
    expect((await db.workoutSession.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("active");
    await syncOne(s.id, { clientId: "audit-working", setNumber: 2, weightKg: 0, reps: 10 });
    const done = await (await complete(req("/api/workouts/complete", { sessionId: s.id }))).json();
    expect(done.summary.xpAwarded).toBe(70);
    expect(done.summary.prs).toHaveLength(0);
  });

  it("F16: weekly volume contains both local-day edges and evening; no future sessions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-25T20:00:00Z"));
    const day = todayISO(user.timezone);
    const first = localDayStartUTC(addDaysISO(day, -6), user.timezone);
    const end = localDayEndUTC(day, user.timezone);
    await db.workoutSession.createMany({ data: [first, new Date("2026-10-25T19:00:00Z"), new Date(end.getTime() + 1000)].map((startedAt, i) => ({ userId: user.id, status: "completed", startedAt, totalVolumeKg: (i + 1) * 100 })) });
    const json = await (await analytics(nextReq("/api/analytics/overview"))).json();
    expect(json.weeklyVolume.at(-1).volume).toBe(300);
    expect(json.totals.sessions).toBe(2);
  });

  it("F21: concurrent different order indexes reuse the same exercise log", async () => {
    const s = await active();
    const results = await Promise.all([syncOne(s.id), syncOne(s.id, { clientId: "audit-set-2", orderIndex: 1, setNumber: 2 })]);
    expect((await results[0].json()).synced).toBe(1);
    expect((await results[1].json()).synced).toBe(1);
    expect(await db.exerciseLog.count({ where: { sessionId: s.id } })).toBe(1);
    expect(await db.setLog.count()).toBe(2);
  });

  it("F21: swap rejects a target already in the plan before any set is logged", async () => {
    const plan = await createPlanFromTemplate(user.id, "ppl");
    const day = await db.workoutPlanDay.findFirstOrThrow({ where: { planId: plan.id, weekNumber: 1, dayNumber: 1 }, include: { exercises: { orderBy: { orderIndex: "asc" } } } });
    const s = await db.workoutSession.create({ data: { userId: user.id, planDayId: day.id, startedAt: new Date() } });
    expect((await swap(req("/api/workouts/swap", { sessionId: s.id, exerciseId: day.exercises[0].exerciseId, targetExerciseId: day.exercises[1].exerciseId, reason: "preference" }))).status).toBe(409);
    expect(await db.exerciseSwap.count()).toBe(0);
  });

  it("F1/F5/F29: admin cannot inspect staff fitness, coach cannot moderate; future tonnage excluded", async () => {
    const coach = await createUser("09121110002", { role: "coach" });
    const admin = await createUser("09121110003", { role: "admin" });
    clearCookies(); await createSession(admin.id, "audit");
    expect((await athleteDetail(new Request("http://localhost/api/coach/athlete/x"), params(coach.id))).status).toBe(404);
    expect(await getCoachAthleteDetail(admin.id)).toBeNull();
    clearCookies(); await createSession(coach.id, "audit");
    await db.coachClient.create({ data: { coachId: coach.id, athleteId: user.id } });
    const post = await db.post.create({ data: { userId: user.id, content: "hello audit" } });
    expect((await moderate(req("/api/admin/moderation", { kind: "post", id: post.id }, "DELETE"))).status).toBe(403);
    await db.workoutSession.createMany({ data: [0, 86_400_000].map(offset => ({ userId: user.id, status: "completed", startedAt: new Date(Date.now() + offset), totalVolumeKg: 100 })) });
    const detail = await getCoachAthleteDetail(user.id);
    expect(detail!.weeklyTonnage.reduce((sum, bucket) => sum + bucket.tonnageKg, 0)).toBe(100);
  });

  it("F2: shared limiter accepts exactly the cap under concurrent calls and resets", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => rateLimit("audit:concurrent", 2, 60_000)));
    expect(results.filter(r => r.ok)).toHaveLength(2);
    expect(results.filter(r => !r.ok).every(r => r.retryAfterSeconds! > 0)).toBe(true);
    const row = await db.rateLimitBucket.findFirstOrThrow();
    expect(row.count).toBe(2);
    await db.rateLimitBucket.update({ where: { key: row.key }, data: { resetAt: new Date(Date.now() - 1) } });
    expect((await rateLimit("audit:concurrent", 2, 60_000)).ok).toBe(true);
  });

  it("F4: public food search never returns private foods and validates its query", async () => {
    await db.food.createMany({ data: [{ slug: "public", nameFa: "عمومی", isPublic: true, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }, { slug: "private", nameFa: "خصوصی", isPublic: false, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }] });
    const json = await (await foods(nextReq("/api/nutrition/foods"))).json();
    expect(json.foods.map((f: { nameFa: string }) => f.nameFa)).toEqual(["عمومی"]);
    expect((await foods(nextReq(`/api/nutrition/foods?q=${"x".repeat(61)}`))).status).toBe(400);
  });

  it("F19/F20/F22: rejects impossible/past/met/duplicate goals and reactivates edited targets", async () => {
    const tomorrow = addDaysISO(todayISO(), 1);
    const body = { type: "workout_frequency", targetValue: 3, targetDate: tomorrow };
    expect((await createGoal(req("/api/goals", { ...body, targetDate: "2026-13-01" }))).status).toBe(400);
    const created = await (await createGoal(req("/api/goals", body))).json();
    expect((await createGoal(req("/api/goals", body))).status).toBe(409);
    await db.goal.update({ where: { id: created.goal.id }, data: { status: "achieved" } });
    const changed = await editGoal(req("/api/goals/x", { targetValue: 5 }, "PATCH"), params(created.goal.id));
    expect((await changed.json()).goal.status).toBe("active");
    expect((await editGoal(req("/api/goals/x", { targetDate: "2000-01-01" }, "PATCH"), params(created.goal.id))).status).toBe(400);
    await db.workoutSession.createMany({ data: Array.from({ length: 4 }, () => ({ userId: user.id, status: "completed", startedAt: new Date() })) });
    expect((await createGoal(req("/api/goals", { ...body, targetValue: 1 }))).status).toBe(400);
  });

  it("F20/F27: invalid/future actual meals rejected while historical entry works", async () => {
    const food = await db.food.create({ data: { slug: "food", nameFa: "تست", calories: 0, proteinG: 0, carbsG: 0, fatG: 0 } });
    const body = { foodId: food.id, mealSlot: "lunch", clientId: "audit-meal" };
    for (const date of ["2026-02-30", "2026-13-01", addDaysISO(todayISO(), 1)]) expect((await addMeal(req("/api/nutrition/day", { ...body, date }))).status).toBe(400);
    expect((await addMeal(req("/api/nutrition/day", { ...body, date: addDaysISO(todayISO(), -1) }))).status).toBe(200);
  });

  it("F30: athlete assignment cap prevents another plan tree and notification", async () => {
    const coach = await createUser("09121110009", { role: "coach" });
    await db.coachClient.create({ data: { coachId: coach.id, athleteId: user.id } });
    for (let i = 0; i < 10; i++) await rateLimit(`coach:assign:${user.id}`, 10, 86_400_000);
    clearCookies(); await createSession(coach.id, "audit");
    const response = await assignPlan(req("/api/coach/assign", { athleteId: user.id, template: "ppl" }));
    expect(response.status).toBe(429);
    expect(await db.workoutPlan.count()).toBe(0);
    expect(await db.notification.count()).toBe(0);
  });

  it("F31: zero quota has a distinct reason from a missing/disabled grant", async () => {
    const actor = (await getSessionUser())!;
    await expect(getAiAccess(actor)).rejects.toMatchObject({ code: "authorization" });
    const provider = await db.aiProvider.create({ data: { label: "fixture", kind: "gemini", model: "fixture", baseUrl: "https://gw.example/v1beta", encryptedKey: encryptProviderKey("fixture"), testedAt: new Date() } });
    await db.aiGrant.create({ data: { userId: user.id, providerId: provider.id, dailyLimit: 0, monthlyLimit: 20 } });
    await expect(getAiAccess(actor)).rejects.toMatchObject({ code: "quota" });
  });

  it("F18: daily sets exclude warmups; weekly protein can be claimed midweek once and reflects deletion", async () => {
    const today = todayISO(); const week = weekStartISO(today);
    const setsMission = await db.mission.create({ data: { slug: "daily-sets", nameFa: "ست", descriptionFa: "تست", criteriaType: "sets_logged", target: 1, xpReward: 40, period: "daily" } });
    const proteinMission = await db.mission.create({ data: { slug: "weekly-protein", nameFa: "پروتئین", descriptionFa: "تست", criteriaType: "protein_hit", target: 1, xpReward: 100, period: "weekly" } });
    const s = await active(); await syncOne(s.id, { isWarmup: true });
    await refreshDerivedMissions(user.id, user.timezone);
    expect((await db.userMissionProgress.findFirstOrThrow({ where: { missionId: setsMission.id } })).progress).toBe(0);
    await syncOne(s.id, { clientId: "audit-set-work", setNumber: 2 });
    const food = await db.food.create({ data: { slug: "protein", nameFa: "protein", calories: 800, proteinG: 200, carbsG: 0, fatG: 0 } });
    await addMeal(req("/api/nutrition/day", { foodId: food.id, mealSlot: "lunch", date: today, clientId: "audit-protein" }));
    await refreshDerivedMissions(user.id, user.timezone);
    expect((await db.userMissionProgress.findFirstOrThrow({ where: { missionId: proteinMission.id } })).periodKey).toBe(week);
    expect((await claimMission(user.id, proteinMission.id)).xp).toBe(100);
    await expect(claimMission(user.id, proteinMission.id)).rejects.toMatchObject({ code: "conflict" });
    expect((await claimMission(user.id, setsMission.id)).xp).toBe(40);
    const entry = await db.mealEntry.findFirstOrThrow();
    await deleteMeal(req("/api/nutrition/day", { entryId: entry.id }, "DELETE"));
    await refreshDerivedMissions(user.id, user.timezone);
    const progress = await db.userMissionProgress.findFirstOrThrow({ where: { missionId: proteinMission.id } });
    expect(progress.progress).toBe(0); expect(progress.claimed).toBe(true);
  });
});
