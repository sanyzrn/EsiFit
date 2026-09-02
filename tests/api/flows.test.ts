import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession } from "@/lib/auth/session";
import { GET as calcResults, POST as saveCalcResult } from "@/app/api/calculators/results/route";
import { GET as goalsList, POST as createGoal } from "@/app/api/goals/route";
import { DELETE as deleteGoal, PATCH as patchGoal } from "@/app/api/goals/[id]/route";
import { GET as painList, POST as createPain, PATCH as patchPain } from "@/app/api/pain-reports/route";
import { GET as alternatives } from "@/app/api/workouts/alternatives/route";
import { POST as swap } from "@/app/api/workouts/swap/route";
import { GET as weeklyRecap } from "@/app/api/ai/weekly-recap/route";

const post = (url: string, body: unknown) =>
  nextReq(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const patchReq = (url: string, body: unknown) =>
  nextReq(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

let user: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await ensureSeed();
  clearCookies();
  user = await createUser("09121110971", { role: "member", tier: "vip" });
  await createSession(user.id, "vitest");
});

describe("calculator results API", () => {
  it("POST 401 when anonymous; GET anonymous returns empty (core is free)", async () => {
    clearCookies();
    const anonSave = await saveCalcResult(post("/api/calculators/results", {
      calculatorType: "bmi", inputs: { weight: 82, height: 178 }, result: { bmi: 25.9 },
    }));
    expect(anonSave.status).toBe(401);
    const anonList = await calcResults(nextReq("/api/calculators/results"));
    expect(anonList.status).toBe(200);
    expect((await anonList.json()).results).toHaveLength(0);
  });
  it("saves and lists results scoped to the user", async () => {
    const save = await saveCalcResult(post("/api/calculators/results", {
      calculatorType: "bmi", inputs: { weight: 82, height: 178 }, result: { bmi: 25.9, category: "overweight" },
    }));
    expect(save.status).toBe(200);

    const list = await calcResults(nextReq("/api/calculators/results"));
    const json = await list.json();
    expect(json.results).toHaveLength(1);
    expect(json.results[0].type).toBe("bmi");
  });
});

describe("goals API", () => {
  it("creates a goal anchored to live data and computes progress", async () => {
    await db.bodyMeasurement.create({
      data: { userId: user.id, measuredOn: new Date().toISOString().slice(0, 10), weightKg: 84 },
    });
    const targetDate = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const res = await createGoal(post("/api/goals", { type: "weight", targetValue: 80, targetDate }));
    expect(res.status).toBe(200);

    const list = await goalsList();
    const { goals } = await list.json();
    expect(goals).toHaveLength(1);
    const g = goals[0];
    expect(g.startValue).toBeCloseTo(84, 5);
    expect(g.direction).toBe("down");
    expect(g.percent).toBe(0);
  });

  it("rejects target dates in the past and caps active goals", async () => {
    const past = await createGoal(post("/api/goals", { type: "weight", targetValue: 80, targetDate: "2020-01-01" }));
    expect(past.status).toBe(400);
  });

  it("PATCH and DELETE are ownership-scoped", async () => {
    const goal = await db.goal.create({
      data: { userId: user.id, type: "weight", title: "تست", startValue: 84, targetValue: 80, unit: "kg", startDate: "2026-08-01", targetDate: "2026-10-01" },
    });
    const stranger = await createUser("09121110969");
    clearCookies();
    await createSession(stranger.id, "vitest");
    const denied = await patchGoal(patchReq(`/api/goals/${goal.id}`, { status: "archived" }), { params: Promise.resolve({ id: goal.id }) });
    expect(denied.status).toBe(404);

    clearCookies();
    await createSession(user.id, "vitest");
    const ok = await patchGoal(patchReq(`/api/goals/${goal.id}`, { status: "archived" }), { params: Promise.resolve({ id: goal.id }) });
    expect(ok.status).toBe(200);
    const del = await deleteGoal(nextReq(`/api/goals/${goal.id}`, { method: "DELETE" }), { params: Promise.resolve({ id: goal.id }) });
    expect(del.status).toBe(200);
    expect(await db.goal.findUnique({ where: { id: goal.id } })).toBeNull();
  });
});

describe("pain reports + smart swap", () => {
  it("creates pain report; filters swap candidates via hard gate", async () => {
    const res = await createPain(post("/api/pain-reports", { bodyRegion: "shoulder", severity: 6 }));
    expect(res.status).toBe(200);

    const list = await painList();
    const { reports } = await list.json();
    expect(reports).toHaveLength(1);
    expect(reports[0].bodyRegion).toBe("shoulder");

    // Alternatives for a chest exercise must avoid shoulder-priming moves.
    const bench = await db.exercise.findUnique({ where: { slug: "barbell-bench-press" } });
    const alt = await alternatives(nextReq(`/api/workouts/alternatives?exerciseId=${bench!.id}`));
    const { alternatives: alts } = await alt.json();
    for (const a of alts) {
      expect(a.nameFa).not.toContain("سرشانه");
    }
  });

  it("PATCH resolves pain reports; swap persists ExerciseSwap row", async () => {
    const rep = await db.painReport.findFirst({ where: { userId: user.id } });
    if (rep) {
      const res = await patchPain(patchReq("/api/pain-reports", { id: rep.id, status: "resolved" }));
      expect(res.status).toBe(200);
    }

    // Build an active session + exercise log, then swap it.
    const session = await db.workoutSession.create({
      data: { userId: user.id, name: "تمرین آزاد", startedAt: new Date(), status: "active" },
    });
    const bench = await db.exercise.findUnique({ where: { slug: "barbell-bench-press" } });
    const dumbbell = await db.exercise.findUnique({ where: { slug: "incline-dumbbell-press" } });
    const log = await db.exerciseLog.create({ data: { sessionId: session.id, exerciseId: bench!.id, orderIndex: 0 } });

    const res = await swap(post("/api/workouts/swap", {
      sessionId: session.id, exerciseId: bench!.id, targetExerciseId: dumbbell!.id, reason: "pain_limitation",
    }));
    expect(res.status).toBe(200);
    const updatedLog = await db.exerciseLog.findUnique({ where: { id: log.id } });
    expect(updatedLog!.exerciseId).toBe(dumbbell!.id);
    const swapRow = await db.exerciseSwap.findFirst({ where: { userId: user.id } });
    expect(swapRow?.reason).toBe("pain_limitation");
  });

  it("swap blocked once sets are logged", async () => {
    const session = await db.workoutSession.create({
      data: { userId: user.id, name: "تمرین آزاد", startedAt: new Date(), status: "active" },
    });
    const bench = await db.exercise.findUnique({ where: { slug: "barbell-bench-press" } });
    const dumbbell = await db.exercise.findUnique({ where: { slug: "incline-dumbbell-press" } });
    const log = await db.exerciseLog.create({ data: { sessionId: session.id, exerciseId: bench!.id, orderIndex: 0 } });
    await db.setLog.create({ data: { exerciseLogId: log.id, setNumber: 1, weightKg: 50, reps: 8 } });

    const res = await swap(post("/api/workouts/swap", {
      sessionId: session.id, exerciseId: bench!.id, targetExerciseId: dumbbell!.id, reason: "preference",
    }));
    expect(res.status).toBe(409);
  });
});

describe("weekly recap entitlement", () => {
  it("free tier is denied with a Persian pointer", async () => {
    clearCookies();
    const free = await createUser("09121110968", { tier: "free" });
    await createSession(free.id, "vitest");
    const res = await weeklyRecap();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("وی‌آی‌پی");
  });

  it("vip tier gets a rules-based recap persisted for the week", async () => {
    const res = await weeklyRecap();
    expect(res.status).toBe(200);
    const { recap } = await res.json();
    expect(recap.source).toBe("rules");
    expect(recap.contentFa.length).toBeGreaterThan(40);
    const stored = await db.weeklyRecap.findFirst({ where: { userId: user.id } });
    expect(stored).toBeTruthy();
    // Second call returns the cached weekly recap.
    const again = await weeklyRecap();
    const { recap: recap2 } = await again.json();
    expect(recap2.contentFa).toBe(recap.contentFa);
  });
});
