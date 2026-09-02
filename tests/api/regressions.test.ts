import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession, getSessionUser } from "@/lib/auth/session";
import { POST as requestOtpPost } from "@/app/api/auth/request-otp/route";
import { POST as startSession } from "@/app/api/workouts/sessions/route";
import { POST as syncSets } from "@/app/api/workouts/sync/route";
import { POST as complete } from "@/app/api/workouts/complete/route";

const post = (url: string, body: unknown) =>
  nextReq(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

let user: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await ensureSeed();
  clearCookies();
  user = await createUser("09121110950", { role: "member", tier: "vip" });
  await createSession(user.id, "vitest");
});

describe("workout completion records real elapsed time", () => {
  it("stores the client's durationSeconds verbatim (not divided by 1000)", async () => {
    const { session } = await (await startSession(post("/api/workouts/sessions", {}))).json();
    const bench = await db.exercise.findUnique({ where: { slug: "barbell-bench-press" } });
    await syncSets(
      post("/api/workouts/sync", {
        sets: [{
          clientId: "dur-regression-1", sessionId: session.id, exerciseId: bench!.id,
          orderIndex: 0, setNumber: 1, weightKg: 60, reps: 8,
        }],
      }),
    );

    const res = await complete(post("/api/workouts/complete", { sessionId: session.id, durationSeconds: 2700 }));
    expect(res.status).toBe(200);
    const { summary } = await res.json();
    expect(summary.durationMinutes).toBe(45);

    const stored = await db.workoutSession.findUnique({ where: { id: session.id } });
    expect(stored!.durationSeconds).toBe(2700);
  });

  it("falls back to wall-clock seconds when the client sends no duration", async () => {
    const started = new Date(Date.now() - 30 * 60_000);
    const s = await db.workoutSession.create({
      data: { userId: user.id, startedAt: started, status: "active" },
    });
    await complete(post("/api/workouts/complete", { sessionId: s.id }));
    const stored = await db.workoutSession.findUnique({ where: { id: s.id } });
    // ~1800s, allowing a second of test runtime drift.
    expect(stored!.durationSeconds).toBeGreaterThan(1750);
    expect(stored!.durationSeconds).toBeLessThan(1850);
  });
});

describe("offline sync is fault-isolated per operation", () => {
  it("counts an unappliable op as a conflict instead of failing the batch", async () => {
    const { session } = await (await startSession(post("/api/workouts/sessions", {}))).json();
    const bench = await db.exercise.findUnique({ where: { slug: "barbell-bench-press" } });

    const res = await syncSets(
      post("/api/workouts/sync", {
        sets: [
          { clientId: "batch-good-1", sessionId: session.id, exerciseId: bench!.id, orderIndex: 0, setNumber: 1, weightKg: 50, reps: 5 },
          { clientId: "batch-bad-1", sessionId: session.id, exerciseId: "does-not-exist", orderIndex: 1, setNumber: 1, weightKg: 50, reps: 5 },
        ],
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.synced).toBe(1);
    expect(json.conflicts).toBe(1);
    // The healthy set still landed.
    expect(await db.setLog.count({ where: { clientId: "batch-good-1" } })).toBe(1);
  });
});

describe("request-otp does not leak account existence", () => {
  it("returns the same shape for a registered and an unregistered phone", async () => {
    await createUser("09121110951");

    const known = await (await requestOtpPost(post("/api/auth/request-otp", { phone: "09121110951" }))).json();
    const unknown = await (await requestOtpPost(post("/api/auth/request-otp", { phone: "09121110952" }))).json();

    expect(known.ok).toBe(true);
    expect(unknown.ok).toBe(true);
    expect(known).not.toHaveProperty("isNewUser");
    expect(unknown).not.toHaveProperty("isNewUser");
    expect(Object.keys(known).sort()).toEqual(Object.keys(unknown).sort());
  });
});

describe("session cookie integrity", () => {
  it("rejects a cookie whose JWT was issued for a different opaque token", async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const mine = store.get("esifit_session")!.value;
    expect(await getSessionUser()).toBeTruthy();

    // Mint a second session, then splice its JWT onto the first raw token.
    clearCookies();
    const other = await createUser("09121110953");
    await createSession(other.id, "vitest");
    const theirJwt = store.get("esifit_session")!.value.slice(store.get("esifit_session")!.value.indexOf(".") + 1);

    const myRaw = mine.slice(0, mine.indexOf("."));
    store.set("esifit_session", `${myRaw}.${theirJwt}`);
    expect(await getSessionUser()).toBeNull();
  });
});
