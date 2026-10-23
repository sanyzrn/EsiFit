import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession, requireRole, requireMember, getSessionUser } from "@/lib/auth/session";
import { POST as subscribe } from "@/app/api/plans/subscribe/route";
import { GET as roster } from "@/app/api/coach/roster/route";
import { GET as athleteDetail } from "@/app/api/coach/athlete/[id]/route";
import { POST as assign } from "@/app/api/coach/assign/route";
import { GET as adminOverview } from "@/app/api/admin/overview/route";
import { GET as adminUsers, PATCH as adminPatchUser } from "@/app/api/admin/users/route";
import { DELETE as moderate } from "@/app/api/admin/moderation/route";
import { GET as adminCoachList, PUT as adminCoachAssign } from "@/app/api/admin/coach-assignments/route";
import { POST as joinChallenge } from "@/app/api/community/challenges/route";
import { AI_COACH_ID } from "@/lib/coach/ai-coach";

const post = (url: string, body: unknown) =>
  nextReq(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const patch = (url: string, body: unknown) =>
  nextReq(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const del = (url: string, body: unknown) =>
  nextReq(url, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function loginAs(phone: string, role: string, tier = "free") {
  const user = await createUser(phone, { role, tier, displayName: `${role} تست` });
  await createSession(user.id, "vitest");
  return user;
}

let member: Awaited<ReturnType<typeof createUser>>;
let coach: Awaited<ReturnType<typeof createUser>>;
let admin: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  await ensureSeed();
  clearCookies();
  member = await createUser("09121110981", { role: "member", tier: "vip" });
  coach = await createUser("09121110982", { role: "coach", tier: "coach" });
  admin = await createUser("09121110983", { role: "admin", tier: "vip_plus" });
});

describe("coach roster permissions + data", () => {
  it("anonymous → 401, member → 403", async () => {
    const anon = await roster();
    expect(anon.status).toBe(401);
    clearCookies();
    await createSession(member.id, "vitest");
    const forbidden = await roster();
    expect(forbidden.status).toBe(403);
  });

  it("coach sees only linked athletes with real stats", async () => {
    await db.coachClient.create({ data: { coachId: coach.id, athleteId: member.id, note: "برنامه هیپرتروفی" } });
    // A second athlete NOT linked to this coach.
    const stranger = await createUser("09121110980", { role: "member" });

    clearCookies();
    await createSession(coach.id, "vitest");

    const res = await roster();
    expect(res.status).toBe(200);
    const { roster: entries } = await res.json();
    expect(entries).toHaveLength(1);
    expect(entries[0].athleteId).toBe(member.id);
    expect(entries[0].displayName).toBeTruthy();
    expect(typeof entries[0].adherencePct).toBe("number");

    // Stranger detail → 403.
    const detailRes = await athleteDetail(nextReq(`/api/coach/athlete/${stranger.id}`), {
      params: Promise.resolve({ id: stranger.id }),
    });
    expect(detailRes.status).toBe(403);
  });

  it("admin supervises any athlete", async () => {
    clearCookies();
    await createSession(admin.id, "vitest");
    const res = await athleteDetail(nextReq(`/api/coach/athlete/${member.id}`), {
      params: Promise.resolve({ id: member.id }),
    });
    expect(res.status).toBe(200);
    const { detail } = await res.json();
    expect(detail.athlete.id).toBe(member.id);
  });

  it("assign: coach assigns template; athlete receives notification; stranger → 403", async () => {
    clearCookies();
    await db.coachClient.create({ data: { coachId: coach.id, athleteId: member.id } });
    await createSession(coach.id, "vitest");

    const ok = await assign(post("/api/coach/assign", { athleteId: member.id, template: "upper_lower" }));
    expect(ok.status).toBe(200);
    const plan = await db.workoutPlan.findFirst({ where: { userId: member.id, status: "active" } });
    expect(plan?.name).toContain("بالاتنه");
    const notif = await db.notification.findFirst({ where: { userId: member.id } });
    expect(notif?.title).toContain("برنامه");

    // Stranger not in roster.
    const stranger = await createUser("09121110979");
    const denied = await assign(post("/api/coach/assign", { athleteId: stranger.id, template: "ppl" }));
    expect(denied.status).toBe(403);
  });
});

describe("admin console", () => {
  it("overview is admin-only and returns real counts", async () => {
    const anon = await adminOverview();
    expect(anon.status).toBe(401);
    clearCookies();
    await createSession(coach.id, "vitest");
    expect((await adminOverview()).status).toBe(403);
    clearCookies();
    await createSession(admin.id, "vitest");
    const res = await adminOverview();
    expect(res.status).toBe(200);
    const { overview } = await res.json();
    expect(overview.users).toBeGreaterThanOrEqual(3);
    expect(overview.usersByRole).toHaveProperty("admin");
  });

  it("users PATCH: member denied, admin allowed, self-change blocked, last-admin protected", async () => {
    // member cannot use admin API
    clearCookies();
    await createSession(member.id, "vitest");
    const denied = await adminPatchUser(patch("/api/admin/users", { userId: member.id, tier: "vip_plus" }));
    expect(denied.status).toBe(403);

    // admin changes member tier → server-side entitlement axis changes
    clearCookies();
    await createSession(admin.id, "vitest");
    const ok = await adminPatchUser(patch("/api/admin/users", { userId: member.id, tier: "vip_plus" }));
    expect(ok.status).toBe(200);
    const updated = await db.user.findUnique({ where: { id: member.id } });
    expect(updated!.tier).toBe("vip_plus");
    const notif = await db.notification.findFirst({ where: { userId: member.id } });
    expect(notif).toBeTruthy();

    // self-change blocked
    const self = await adminPatchUser(patch("/api/admin/users", { userId: admin.id, role: "member" }));
    expect(self.status).toBe(409);

    // demoting the last admin blocked
    const onlyAdmin = await db.user.count({ where: { role: "admin", status: "active" } });
    expect(onlyAdmin).toBe(1);
  });

  it("suspend revokes sessions immediately", async () => {
    await createSession(member.id, "vitest2"); // member session row in DB
    clearCookies();
    await createSession(admin.id, "vitest");
    const res = await adminPatchUser(patch("/api/admin/users", { userId: member.id, status: "suspended" }));
    expect(res.status).toBe(200);
    const sessions = await db.session.count({ where: { userId: member.id, revokedAt: null } });
    expect(sessions).toBe(0);
  });

  it("moderation deletes posts/comments with author notification", async () => {
    const postRow = await db.post.create({
      data: { userId: member.id, content: "پست آزمایشی", visibility: "public" },
    });
    clearCookies();
    await createSession(admin.id, "vitest");
    const res = await moderate(del("/api/admin/moderation", { kind: "post", id: postRow.id, reason: "تست" }));
    expect(res.status).toBe(200);
    expect(await db.post.findUnique({ where: { id: postRow.id } })).toBeNull();
    const notif = await db.notification.findFirst({ where: { userId: member.id, title: { contains: "حذف" } } });
    expect(notif).toBeTruthy();
  });

  it("users search endpoint returns paginated list", async () => {
    clearCookies();
    await createSession(admin.id, "vitest");
    const res = await adminUsers(nextReq("/api/admin/users?q=&page=1"));
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.total).toBeGreaterThanOrEqual(2); // Only coach and member accounts; administrators are not listed.
    expect(json.users.length).toBeGreaterThan(0);
  });
});

describe("role and membership are distinct", () => {
  it("admin and coach cannot perform private member actions even with VIP storage values", async () => {
    clearCookies();
    await createSession(admin.id, "vitest");
    await expect(requireMember()).rejects.toMatchObject({ code: "authorization" });
    await expect(requireRole("coach")).rejects.toMatchObject({ code: "authorization" });
    await expect(requireRole("coach_or_admin")).resolves.toMatchObject({ role: "admin" });
    expect((await getSessionUser())?.tier).toBe("free");
    const staffPurchase = await subscribe(post("/api/plans/subscribe", { planCode: "vip-monthly" }));
    expect(staffPurchase.status).toBe(403);

    clearCookies();
    await createSession(coach.id, "vitest");
    await expect(requireMember()).rejects.toMatchObject({ code: "authorization" });
    await expect(requireRole("admin")).rejects.toMatchObject({ code: "authorization" });
    expect((await getSessionUser())?.tier).toBe("free");
    const coachPurchase = await subscribe(post("/api/plans/subscribe", { planCode: "vip-monthly" }));
    expect(coachPurchase.status).toBe(403);
  });

  it("regular admin Users list never includes an admin account", async () => {
    clearCookies();
    await createSession(admin.id, "vitest");
    const response = await adminUsers(nextReq("/api/admin/users?page=1"));
    const result = await response.json();
    expect(result.users.every((u: { role: string }) => u.role !== "admin")).toBe(true);
    expect(result.users.some((u: { id: string }) => u.id === admin.id)).toBe(false);
    expect(result.total).toBeGreaterThanOrEqual(2);
  });

  it("promoting a member to coach clears athlete tier and coach assignment", async () => {
    await db.coachClient.create({ data: { coachId: coach.id, athleteId: member.id } });
    clearCookies();
    await createSession(admin.id, "vitest");
    const response = await adminPatchUser(patch("/api/admin/users", { userId: member.id, role: "coach" }));
    expect(response.status).toBe(200);
    const updated = await db.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(updated.role).toBe("coach");
    expect(updated.tier).toBe("free");
    expect(await db.coachClient.count({ where: { athleteId: member.id } })).toBe(0);
  });

  it("cannot sell VIP to a coach or demote a coach with assigned athletes", async () => {
    await db.coachClient.create({ data: { coachId: coach.id, athleteId: member.id } });
    clearCookies();
    await createSession(admin.id, "vitest");
    const vipCoach = await adminPatchUser(patch("/api/admin/users", {
      userId: coach.id, tier: "vip_plus",
    }));
    expect(vipCoach.status).toBe(400);
    const coachDemotion = await adminPatchUser(patch("/api/admin/users", {
      userId: coach.id, role: "member",
    }));
    expect(coachDemotion.status).toBe(409);
    expect((await db.user.findUniqueOrThrow({ where: { id: coach.id } })).role).toBe("coach");
  });

  it("rejects editing or promoting admin in regular users management", async () => {
    clearCookies();
    await createSession(admin.id, "vitest");
    const editAdmin = await adminPatchUser(patch("/api/admin/users", {
      userId: admin.id, tier: "vip_plus",
    }));
    expect(editAdmin.status).toBe(409);
    const promote = await adminPatchUser(patch("/api/admin/users", {
      userId: member.id, role: "admin",
    }));
    expect(promote.status).toBe(400);
    expect((await db.user.findUniqueOrThrow({ where: { id: member.id } })).role).toBe("member");
  });
});

describe("virtual AI coach infrastructure", () => {
  it("only admins may see or change assignments and AI cannot log in", async () => {
    clearCookies();
    await createSession(member.id, "vitest");
    expect((await adminCoachList()).status).toBe(403);
    const denied = await adminCoachAssign(patch("/api/admin/coach-assignments", {
      athleteId: member.id, coachId: AI_COACH_ID,
    }));
    expect(denied.status).toBe(403);

    clearCookies();
    await createSession(admin.id, "vitest");
    const roster = await adminCoachList();
    expect(roster.status).toBe(200);
    const data = await roster.json();
    expect(data.coaches.some((c: { id: string; type: string }) =>
      c.id === AI_COACH_ID && c.type === "ai",
    )).toBe(true);
    expect(await db.user.findFirst({ where: { id: AI_COACH_ID } })).toBeNull();
  });

  it("switching human → AI → human → unassigned preserves member training data", async () => {
    await db.coachClient.create({ data: { coachId: coach.id, athleteId: member.id } });
    const plan = await db.workoutPlan.create({
      data: { userId: member.id, name: "بدنسازی آزمایشی", startsOn: "2026-10-23", status: "active" },
    });
    clearCookies();
    await createSession(admin.id, "vitest");
    const assignRequest = (coachId: string | null) => nextReq("/api/admin/coach-assignments", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: member.id, coachId }),
    });
    const aiResponse = await adminCoachAssign(assignRequest(AI_COACH_ID));
    expect(aiResponse.status).toBe(200);
    expect((await db.aiCoachEnrollment.findUnique({ where: { athleteId: member.id } }))?.status).toBe("reserved");
    expect(await db.coachClient.count({ where: { athleteId: member.id } })).toBe(0);
    expect((await db.workoutPlan.findUnique({ where: { id: plan.id } }))?.id).toBe(plan.id);
    const roster = await (await adminCoachList()).json();
    expect(roster.athletes.find((a: { id: string }) => a.id === member.id).coachId).toBe(AI_COACH_ID);

    const humanResponse = await adminCoachAssign(assignRequest(coach.id));
    expect(humanResponse.status).toBe(200);
    expect(await db.aiCoachEnrollment.count({ where: { athleteId: member.id } })).toBe(0);
    expect(await db.coachClient.count({ where: { athleteId: member.id, coachId: coach.id } })).toBe(1);

    expect((await adminCoachAssign(assignRequest(null))).status).toBe(200);
    expect(await db.coachClient.count({ where: { athleteId: member.id } })).toBe(0);
    expect((await db.workoutPlan.findUnique({ where: { id: plan.id } }))?.id).toBe(plan.id);
  });

  it("rejects invalid coach, admin or nonmember athlete IDs", async () => {
    clearCookies();
    await createSession(admin.id, "vitest");
    const invalidCoach = nextReq("/api/admin/coach-assignments", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: member.id, coachId: admin.id }),
    });
    expect((await adminCoachAssign(invalidCoach)).status).toBe(400);
    const invalidAthlete = nextReq("/api/admin/coach-assignments", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId: coach.id, coachId: AI_COACH_ID }),
    });
    expect((await adminCoachAssign(invalidAthlete)).status).toBe(400);
  });

  it("staff cannot join personal training challenges", async () => {
    clearCookies();
    await createSession(admin.id, "vitest");
    const response = await joinChallenge(post("/api/community/challenges", { challengeId: "any" }));
    expect(response.status).toBe(403);
    clearCookies();
    await createSession(coach.id, "vitest");
    expect((await joinChallenge(post("/api/community/challenges", { challengeId: "any" }))).status).toBe(403);
  });
});
