import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession, getSessionUser } from "@/lib/auth/session";
import { db as appDb } from "@/lib/db";
import { GET as exportData } from "@/app/api/settings/export/route";
import { PATCH as equipment } from "@/app/api/settings/profile/route";
import { GET as orders } from "@/app/api/store/orders/route";
import { POST as checkout } from "@/app/api/store/checkout/route";
import { GET as plans, POST as subscribe, DELETE as cancel } from "@/app/api/plans/subscribe/route";
import { GET as adminOverview } from "@/app/api/admin/overview/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as logout } from "@/app/api/auth/logout/route";

const post = (path: string, body: unknown, method = "POST") => nextReq(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
let user: Awaited<ReturnType<typeof createUser>>;
beforeEach(async () => { await ensureSeed(); clearCookies(); user = await createUser("09121110701"); await createSession(user.id, "commerce-test"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const product = (stock = 10) => db.product.create({ data: { slug: "receipt-product", nameFa: "شیکر قدیمی", priceToman: 389001, stock } });
const plan = (code = "vip_monthly", tier = "vip") => db.subscriptionPlan.create({ data: { code, tier, nameFa: code, billingPeriod: "monthly", priceToman: 249000 } });
async function limit(key: string) { await db.rateLimitBucket.create({ data: { key: createHash("sha256").update(key).digest("hex"), count: 10, resetAt: new Date(Date.now() + 3600_000) } }); }

describe("phase 5 commerce and privacy regressions", () => {
  it("expiry rechecks under the subscription lock before downgrading a stale snapshot", async () => {
    await db.user.update({ where: { id: user.id }, data: { tier: "vip_plus" } });
    const expired = await db.subscription.create({ data: { userId: user.id, planCode: "old", tier: "vip", currentPeriodEndsAt: new Date(0) } });
    await db.subscription.create({ data: { userId: user.id, planCode: "new", tier: "vip_plus", currentPeriodEndsAt: new Date(Date.now() + 86_400_000) } });
    // Simulate a subscription read taken immediately before a new purchase.
    vi.spyOn(appDb.subscription, "findMany").mockResolvedValueOnce([expired]);
    expect((await getSessionUser())?.tier).toBe("vip_plus");
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).tier).toBe("vip_plus");
  });
  it("F46: free members export all retained fitness and owned commerce metadata without credentials or foreign records", async () => {
    const other = await createUser("09121110702");
    const own = await db.order.create({ data: { userId: user.id, totalToman: 1200, itemsJson: "[]" } });
    const foreign = await db.order.create({ data: { userId: other.id, totalToman: 999, itemsJson: "[]" } });
    await db.bodyMeasurement.create({ data: { userId: user.id, measuredOn: "2020-01-01", weightKg: 80 } });
    await db.subscription.create({ data: { userId: user.id, planCode: "old", tier: "vip", status: "canceled", currentPeriodEndsAt: new Date(0) } });
    const tokens = await db.session.findMany({ where: { userId: user.id } });
    const response = await exportData(); expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    const text = await response.text(); const json = JSON.parse(text);
    expect(json.measurements).toHaveLength(1); expect(json.measurements[0].measuredOn).toBe("2020-01-01");
    expect(json.orders.map((r: { id: string }) => r.id)).toEqual([own.id]);
    expect(text).not.toContain(foreign.id); expect(text).not.toContain(tokens[0].tokenHash);
    expect(json.subscriptions).toHaveLength(1); expect(json.account.theme).toBeDefined();
    clearCookies(); expect((await exportData()).status).toBe(401);
    const coach = await createUser("09121110703", { role: "coach" }); await createSession(coach.id, "coach");
    expect((await exportData()).status).toBe(403);
  });

  it("F52: invalid equipment is rejected without resetting the previous valid choice", async () => {
    await db.userProfile.update({ where: { userId: user.id }, data: { availableEquipment: '["dumbbell"]' } });
    for (const availableEquipment of [["bogus"], ["dumbbell", "bogus"]]) expect((await equipment(post("/api/settings/profile", { availableEquipment }, "PATCH"))).status).toBe(400);
    expect((await db.userProfile.findUniqueOrThrow({ where: { userId: user.id } })).availableEquipment).toBe('["dumbbell"]');
    expect((await (await equipment(post("/api/settings/profile", { availableEquipment: [] }, "PATCH"))).json()).unrestricted).toBe(true);
  });

  it("F47: receipts preserve authoritative unit rounding and checkout values after catalog edits", async () => {
    await db.user.update({ where: { id: user.id }, data: { tier: "vip_plus" } });
    const p = await product(); const unit = Math.round(p.priceToman * 0.9);
    const response = await checkout(post("/api/store/checkout", { items: [{ productId: p.id, qty: 3 }], totalToman: 1 }));
    expect(response.status).toBe(200); const receipt = (await response.json()).order;
    expect(receipt.totalToman).toBe(unit * 3); expect(receipt.items[0].unitPriceToman).toBe(unit); expect(receipt.currency).toBe("IRT");
    await db.product.update({ where: { id: p.id }, data: { nameFa: "نام جدید", priceToman: 1, status: "archived" } });
    const history = await (await orders(nextReq("/api/store/orders"))).json();
    expect(history.orders[0]).toMatchObject({ id: receipt.id, totalToman: unit * 3, items: [{ nameFa: "شیکر قدیمی", unitPriceToman: unit }] });
  });

  it("F47: history pagination is owner-scoped, stable on equal timestamps, and tolerates legacy malformed item JSON", async () => {
    const other = await createUser("09121110704"); const createdAt = new Date();
    await db.order.createMany({ data: Array.from({ length: 23 }, (_, i) => ({ userId: user.id, createdAt, totalToman: i, itemsJson: i === 0 ? "bad-json" : JSON.stringify([{ productId: "legacy", nameFa: "قدیمی", priceToman: 100, qty: 1 }]) })) });
    const foreign = await db.order.create({ data: { userId: other.id, totalToman: 1, itemsJson: "[]", createdAt } });
    const firstResponse = await orders(nextReq(`/api/store/orders?userId=${other.id}`));
    const first = await firstResponse.json(); expect(first.orders).toHaveLength(20); expect(firstResponse.headers.get("Cache-Control")).toContain("private");
    const second = await (await orders(nextReq(`/api/store/orders?cursor=${encodeURIComponent(first.nextCursor)}`))).json();
    expect(second.orders).toHaveLength(3); expect(second.nextCursor).toBeNull();
    const all = [...first.orders, ...second.orders]; expect(new Set(all.map(r => r.id)).size).toBe(23); expect(all.some(r => r.id === foreign.id)).toBe(false);
    expect(all.filter(r => r.items.length === 0)).toHaveLength(1);
    expect((await orders(nextReq("/api/store/orders?cursor=invalid"))).status).toBe(400);
    clearCookies(); expect((await orders(nextReq("/api/store/orders"))).status).toBe(401);
  });

  it("preserves stock rollback and admits one winner for concurrent checkout of the last stock", async () => {
    const p = await product(10);
    const responses = await Promise.all([checkout(post("/api/store/checkout", { items: [{ productId: p.id, qty: 6 }] })), checkout(post("/api/store/checkout", { items: [{ productId: p.id, qty: 6 }] }))]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(4); expect(await db.order.count()).toBe(1);
    const second = await db.product.create({ data: { slug: "out", nameFa: "ناموجود", priceToman: 100, stock: 0 } });
    expect((await checkout(post("/api/store/checkout", { items: [{ productId: p.id, qty: 1 }, { productId: second.id, qty: 1 }] }))).status).toBe(409);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(4);
  });

  it("F48: cancellation downgrades only the caller immediately, preserves records, and is idempotent", async () => {
    const p = await plan(); expect((await subscribe(post("/api/plans/subscribe", { planCode: p.code }))).status).toBe(200);
    const other = await createUser("09121110705", { tier: "vip" });
    await db.subscription.create({ data: { userId: other.id, planCode: p.code, tier: "vip", currentPeriodEndsAt: new Date(Date.now() + 86_400_000) } });
    const before = await (await plans()).json(); expect(before.currentSubscription).not.toBeNull();
    const first = await (await cancel()).json(); expect(first).toMatchObject({ canceled: true, tier: "free" });
    expect((await getSessionUser())?.tier).toBe("free");
    expect((await (await plans()).json()).currentSubscription).toBeNull();
    expect((await (await cancel()).json()).canceled).toBe(false);
    expect(await db.notification.count({ where: { userId: user.id, title: "اشتراک شما لغو شد" } })).toBe(1);
    expect(await db.subscription.count({ where: { userId: other.id, status: "active" } })).toBe(1);
    expect(await db.subscription.count({ where: { userId: user.id, status: "canceled" } })).toBe(1);
    expect((await exportData()).status).toBe(200);
  });

  it("F48: manually granted tiers are not erased by canceling a nonexistent purchased subscription", async () => {
    await db.user.update({ where: { id: user.id }, data: { tier: "vip" } });
    const response = await (await cancel()).json(); expect(response).toMatchObject({ canceled: false, tier: "vip" });
    expect((await getSessionUser())?.tier).toBe("vip");
    const coach = await createUser("09121110706", { role: "coach" }); clearCookies(); await createSession(coach.id, "coach"); expect((await cancel()).status).toBe(403);
  });

  it("F48: concurrent plan changes and cancellation leave a single consistent entitlement", async () => {
    const a = await plan("plan-a", "vip"); const b = await plan("plan-b", "vip_plus");
    const changes = await Promise.all([subscribe(post("/api/plans/subscribe", { planCode: a.code })), subscribe(post("/api/plans/subscribe", { planCode: b.code }))]);
    expect(changes.every(r => r.status === 200)).toBe(true);
    let active = await db.subscription.findMany({ where: { userId: user.id, status: "active" } }); expect(active).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).tier).toBe(active[0].tier);
    await Promise.all([cancel(), subscribe(post("/api/plans/subscribe", { planCode: a.code }))]);
    active = await db.subscription.findMany({ where: { userId: user.id, status: "active" } });
    expect(active.length).toBeLessThanOrEqual(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).tier).toBe(active[0]?.tier ?? "free");
  });

  it("F50: both paid-mutation caps reject before orders, stock or subscriptions change", async () => {
    const p = await product(); const subscriptionPlan = await plan();
    await limit(`store:checkout:${user.id}`); await limit(`plans:subscribe:${user.id}`);
    expect((await checkout(post("/api/store/checkout", { items: [{ productId: p.id, qty: 1 }] }))).status).toBe(429);
    expect((await subscribe(post("/api/plans/subscribe", { planCode: subscriptionPlan.code }))).status).toBe(429);
    expect(await db.order.count()).toBe(0); expect(await db.subscription.count()).toBe(0); expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(10);
  });

  it("production mock-payment gates remain closed on checkout and subscribe", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("ALLOW_MOCK_PAYMENT", "false");
    expect((await checkout(post("/api/store/checkout", { items: [] }))).status).toBe(502);
    expect((await subscribe(post("/api/plans/subscribe", { planCode: "any" }))).status).toBe(502);
    expect(await db.order.count()).toBe(0); expect(await db.subscription.count()).toBe(0);
  });

  it("F49: admin commerce totals use recorded paid orders and exclude canceled/expired subscriptions", async () => {
    const admin = await createUser("09121110707", { role: "admin" });
    await db.order.createMany({ data: [{ userId: user.id, totalToman: 1000, itemsJson: "[]", status: "paid" }, { userId: user.id, totalToman: 9999, itemsJson: "[]", status: "pending" }] });
    await db.subscription.createMany({ data: [
      { userId: user.id, planCode: "active", tier: "vip", currentPeriodEndsAt: new Date(Date.now() + 86_400_000) },
      { userId: user.id, planCode: "expired", tier: "vip", currentPeriodEndsAt: new Date(0) },
      { userId: user.id, planCode: "canceled", tier: "vip", status: "canceled", currentPeriodEndsAt: new Date(Date.now() + 86_400_000) },
    ] });
    expect((await adminOverview()).status).toBe(403); clearCookies(); await createSession(admin.id, "admin");
    const result = await (await adminOverview()).json(); expect(result.overview.commerce).toEqual({ mode: "mock", currency: "IRT", orders30d: 1, recordedOrderTotal30dToman: 1000, activeSubscriptions: 1 });
  });

  it("F51/F53: preserves anonymous session discovery and exposes only supported IRT plans", async () => {
    const p = await plan(); const foreignCurrency = await plan("unsupported"); await db.subscriptionPlan.update({ where: { id: foreignCurrency.id }, data: { currency: "USD" } });
    const catalog = await (await plans()).json(); expect(catalog.plans.map((x: { code: string }) => x.code)).toEqual([p.code]); expect(catalog.plans[0].currency).toBe("IRT");
    expect((await subscribe(post("/api/plans/subscribe", { planCode: foreignCurrency.code }))).status).toBe(404);
    await logout(); const session = await me(); expect(session.status).toBe(200); expect(await session.json()).toEqual({ ok: true, user: null });
  });
});
