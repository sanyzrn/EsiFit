import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession } from "@/lib/auth/session";
import { GET as getSessions, POST as startSession } from "@/app/api/workouts/sessions/route";
import { POST as syncSets } from "@/app/api/workouts/sync/route";
import { POST as complete } from "@/app/api/workouts/complete/route";

const post = (url: string, body: unknown) =>
  nextReq(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

let user: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await ensureSeed();
  clearCookies();
  user = await createUser("09121110961", { role: "member", tier: "vip" });
  await createSession(user.id, "vitest");
});

describe("workout session lifecycle (offline-first sync)", () => {
  it("starts a session and syncs sets idempotently by clientId", async () => {
    const start = await startSession(post("/api/workouts/sessions", {}));
    expect(start.status).toBe(200);
    const { session } = await start.json();

    const bench = await db.exercise.findUnique({ where: { slug: "barbell-bench-press" } });
    const setId = "client-set-0001";
    const setPayload = {
      clientId: setId, sessionId: session.id, exerciseId: bench!.id,
      orderIndex: 0, setNumber: 1, weightKg: 60, reps: 8, rpe: 7.5,
      completedAt: new Date().toISOString(),
    };
    const payload = { sets: [setPayload] };
    const sync1 = await syncSets(post("/api/workouts/sync", payload));
    expect(sync1.status).toBe(200);
    const j1 = await sync1.json();
    expect(j1.synced).toBe(1);
    expect(j1.conflicts).toBe(0);

    // Replay the same clientId → idempotent (no duplicate set).
    const sync2 = await syncSets(post("/api/workouts/sync", payload));
    const j2 = await sync2.json();
    expect(j2.synced + j2.conflicts).toBeLessThanOrEqual(1);
    const setCount = await db.setLog.count({ where: { clientId: setId } });
    expect(setCount).toBe(1);

    const total = await db.setLog.count();
    expect(total).toBe(1);
  });

  it("rejects syncing into another user's session", async () => {
    const strangerSession = await db.workoutSession.create({
      data: { userId: user.id, startedAt: new Date(), status: "active" },
    });
    clearCookies();
    const stranger = await createUser("09121110960");
    await createSession(stranger.id, "vitest");
    const bench = await db.exercise.findUnique({ where: { slug: "barbell-bench-press" } });
    const res = await syncSets(post("/api/workouts/sync", {
      sets: [{
        clientId: "evil-set", sessionId: strangerSession.id, exerciseId: bench!.id, orderIndex: 0, setNumber: 1, weightKg: 100, reps: 5, completedAt: new Date().toISOString(),
      }],
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Ownership violation is parked as conflict, never written.
    expect(json.conflicts).toBe(1);
    expect(await db.setLog.count({ where: { clientId: "evil-set" } })).toBe(0);
  });

  it("completion detects PR, awards XP once, and demotes the old record", async () => {
    // Pre-existing current record: bench 70kg.
    const bench = await db.exercise.findUnique({ where: { slug: "barbell-bench-press" } });
    await db.personalRecord.create({
      data: { userId: user.id, exerciseId: bench!.id, recordType: "weight", value: 70, unit: "kg", achievedAt: new Date(Date.now() - 30 * 86400000), isCurrent: true },
    });

    const start = await startSession(post("/api/workouts/sessions", {}));
    const { session } = await start.json();
    await syncSets(post("/api/workouts/sync", {
      sets: [{
        clientId: "pr-set-1", sessionId: session.id, exerciseId: bench!.id, orderIndex: 0, setNumber: 1, weightKg: 75, reps: 5, completedAt: new Date().toISOString(),
      }],
    }));

    const done = await complete(post("/api/workouts/complete", {
      sessionId: session.id, durationSeconds: 3000,
    }));
    expect(done.status).toBe(200);
    const { summary } = await done.json();
    expect(summary.prs).toHaveLength(1);
    // PR stores the estimated 1RM (Epley/Brzycki average of 75×5 ≈ 85.9), not the raw set weight.
    expect(summary.prs[0].value).toBeGreaterThan(75);
    expect(summary.xpAwarded).toBeGreaterThan(0);

    const current = await db.personalRecord.findFirst({ where: { userId: user.id, exerciseId: bench!.id, isCurrent: true } });
    expect(current!.value).toBe(summary.prs[0].value);
    const demoted = await db.personalRecord.count({ where: { userId: user.id, exerciseId: bench!.id, isCurrent: false } });
    expect(demoted).toBe(1);

    // Idempotency: re-completing must not double-award XP.
    const again = await complete(post("/api/workouts/complete", { sessionId: session.id, durationSeconds: 3000 }));
    const againJson = await again.json();
    const xpEntries = await db.xpLog.count({ where: { userId: user.id, sourceType: "workout" } });
    expect(xpEntries).toBe(1);
    expect(againJson.ok === false || againJson.alreadyCompleted === true || againJson.summary?.xpAwarded === 0).toBe(true);
  });

  it("complete requires ownership and an active session", async () => {
    const stranger = await createUser("09121110959");
    const otherSession = await db.workoutSession.create({
      data: { userId: stranger.id, startedAt: new Date(), status: "active" },
    });
    const res = await complete(post("/api/workouts/complete", { sessionId: otherSession.id, durationSeconds: 100 }));
    expect(res.status).toBe(404);
  });

  it("GET returns the active session with shaped exercises", async () => {
    const active = await getSessions();
    expect(active.status).toBe(200);
    const json = await active.json();
    expect(json.session).toBeNull(); // none yet
    await startSession(post("/api/workouts/sessions", {}));
    const now = await getSessions();
    const { session } = await now.json();
    expect(session).toBeTruthy();
    expect(Array.isArray(session.exercises)).toBe(true);
  });
});
