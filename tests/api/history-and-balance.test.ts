import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession } from "@/lib/auth/session";
import { createPlanFromTemplate } from "@/features/workouts/data/plan-templates";
import { POST as startSession } from "@/app/api/workouts/sessions/route";
import { GET as analytics } from "@/app/api/analytics/overview/route";

const post = (url: string, body: unknown) =>
  nextReq(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

let user: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await ensureSeed();
  clearCookies();
  user = await createUser("09121110988", { role: "member", tier: "vip" });
  await createSession(user.id, "vitest");
});

/** A finished session with the given working sets for one exercise. */
async function finishedSession(slug: string, daysAgo: number, weight: number, reps: number[], extra?: { warmup?: boolean }) {
  const ex = await db.exercise.findUniqueOrThrow({ where: { slug } });
  const startedAt = new Date(Date.now() - daysAgo * 86_400_000);
  const session = await db.workoutSession.create({
    data: { userId: user.id, startedAt, endedAt: new Date(startedAt.getTime() + 3_600_000), status: "completed", name: "t", durationSeconds: 3600, totalVolumeKg: 1 },
  });
  const log = await db.exerciseLog.create({ data: { sessionId: session.id, exerciseId: ex.id, orderIndex: 0 } });
  let n = 1;
  if (extra?.warmup) {
    await db.setLog.create({ data: { exerciseLogId: log.id, userId: user.id, setNumber: n++, weightKg: 20, reps: 10, isWarmup: true, completedAt: startedAt, clientId: `w-${slug}-${daysAgo}` } });
  }
  for (const r of reps) {
    await db.setLog.create({ data: { exerciseLogId: log.id, userId: user.id, setNumber: n++, weightKg: weight, reps: r, completedAt: startedAt, clientId: `s-${slug}-${daysAgo}-${n}` } });
  }
  return ex;
}

describe("live session opens pre-filled from last time", () => {
  it("attaches last performance and a double-progression suggestion per exercise", async () => {
    await createPlanFromTemplate(user.id, "ppl", undefined, null);
    const plan = await db.workoutPlanDay.findFirstOrThrow({
      where: { plan: { userId: user.id }, weekNumber: 1, exercises: { some: { exercise: { slug: "barbell-bench-press" } } } },
      include: { exercises: { include: { exercise: true } } },
    });
    const planned = plan.exercises.find((e) => e.exercise.slug === "barbell-bench-press")!;
    // Top of the prescribed range on every set → next time should add load.
    await finishedSession("barbell-bench-press", 3, 80, Array(3).fill(planned.targetRepsMax), { warmup: true });

    const res = await startSession(post("/api/workouts/sessions", { planDayId: plan.id }));
    expect(res.status).toBe(200);
    const { session } = await res.json();
    const bench = session.exercises.find((e: { slug: string }) => e.slug === "barbell-bench-press");

    expect(bench.equipment).toBe("barbell");
    expect(bench.history.last.sets).toHaveLength(3); // warm-up excluded
    expect(bench.history.suggestion).toMatchObject({ kind: "progress", weightKg: 82.5 });

    // An exercise never done before has no history and no suggestion.
    const untouched = session.exercises.find((e: { slug: string }) => e.slug !== "barbell-bench-press");
    expect(untouched.history).toEqual({ last: null, suggestion: null });
  });
});

describe("analytics: balance & recovery", () => {
  it("derives weekly sets, a push/pull verdict and per-muscle recovery from real logs", async () => {
    // Heavy pressing, no pulling, trained yesterday.
    for (const d of [1, 4, 8, 11]) await finishedSession("barbell-bench-press", d, 80, [8, 8, 8, 8]);

    const res = await analytics(nextReq("/api/analytics/overview"));
    const json = await res.json();

    expect(json.weeklySets.chest).toBeGreaterThan(0);
    const pp = json.balance.find((p: { key: string }) => p.key === "push_pull");
    expect(pp.status).toBe("lean_a");

    const chest = json.recovery.find((r: { slug: string }) => r.slug === "chest");
    expect(chest.state).toBe("recovering"); // trained ~1 day ago
    expect(chest.intensity).toBeGreaterThan(50);
  });

  it("does not leak advanced payloads to the free tier", async () => {
    await db.user.update({ where: { id: user.id }, data: { tier: "free" } });
    await finishedSession("barbell-bench-press", 2, 60, [8, 8, 8]);
    const json = await (await analytics(nextReq("/api/analytics/overview"))).json();
    expect(json.balance).toEqual([]);
    expect(json.recovery).toEqual([]);
  });
});
