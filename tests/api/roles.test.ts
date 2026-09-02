import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession } from "@/lib/auth/session";
import { GET as roster } from "@/app/api/coach/roster/route";
import { GET as athleteDetail } from "@/app/api/coach/athlete/[id]/route";
import { POST as assign } from "@/app/api/coach/assign/route";
import { GET as adminOverview } from "@/app/api/admin/overview/route";
import { GET as adminUsers, PATCH as adminPatchUser } from "@/app/api/admin/users/route";
import { DELETE as moderate } from "@/app/api/admin/moderation/route";

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
    expect(json.total).toBeGreaterThanOrEqual(3);
    expect(json.users.length).toBeGreaterThan(0);
  });
});
