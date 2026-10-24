import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { db, createUser, ensureSeed } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession, getSessionUser } from "@/lib/auth/session";
import {
  GET as settings,
  PUT as saveProvider,
  PATCH as grantAccess,
} from "@/app/api/admin/ai/route";
import { GET as chatState, POST as chat } from "@/app/api/ai/chat/route";
import { POST as confirm } from "@/app/api/ai/actions/route";
import {
  claimAiQuotaSlot,
  releaseAiQuotaSlot,
  finalizeAiQuota,
} from "@/lib/ai/quota";
import { proposeAction, assistantTools } from "@/lib/ai/actions";
import { encryptProviderKey } from "@/lib/ai/secrets";
import { probeProvider, configuredModel } from "@/lib/ai/provider";
import { todayISO } from "@/lib/dates/jalali";
vi.mock("@/lib/ai/provider", async (original) => ({
  ...(await original<typeof import("@/lib/ai/provider")>()),
  probeProvider: vi.fn(),
  configuredModel: vi.fn(),
}));
const send = (path: string, json: unknown, method = "POST") =>
  nextReq(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
let member: Awaited<ReturnType<typeof createUser>>;
let coach: typeof member;
let admin: typeof member;
let provider: Awaited<ReturnType<typeof db.aiProvider.create>>;
async function login(id: string) {
  clearCookies();
  await createSession(id, "ai-test");
  return (await getSessionUser())!;
}
async function grant(userId: string, dailyLimit = 20, monthlyLimit = 300) {
  await db.aiGrant.create({
    data: { userId, providerId: provider.id, dailyLimit, monthlyLimit },
  });
}
async function conversation(actorId: string, role = "admin") {
  return db.aiConversation.create({
    data: { userId: actorId, contextType: `hampa:${role}` },
  });
}
function mockModel(fail = false) {
  vi.mocked(configuredModel).mockReturnValue(
    new MockLanguageModelV4({
      doGenerate: async () => {
        if (fail) throw new Error("fixture-provider-failure");
        return {
          content: [
            { type: "text", text: "سلام؛ برای تمرین در اسی‌فیت کنارتان هستم." },
          ],
          finishReason: { unified: "stop", raw: undefined },
          usage: {
            inputTokens: {
              total: 12,
              noCache: 12,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
          warnings: [],
        };
      },
    }),
  );
}
beforeEach(async () => {
  await ensureSeed();
  clearCookies();
  vi.mocked(probeProvider).mockResolvedValue(undefined);
  mockModel();
  member = await createUser("09129999001");
  coach = await createUser("09129999002", { role: "coach", tier: "coach" });
  admin = await createUser("09129999003", { role: "admin" });
  provider = await db.aiProvider.create({
    data: {
      label: "fixture",
      kind: "gemini",
      baseUrl: "https://gw.example/v1beta",
      model: "fixture",
      encryptedKey: encryptProviderKey("fixture-secret-key"),
      testedAt: new Date(),
    },
  });
});
describe("AI administration and grants", () => {
  it("requires admin and never returns encrypted or plaintext credentials", async () => {
    expect((await settings(nextReq("/api/admin/ai"))).status).toBe(401);
    await login(coach.id);
    expect((await settings(nextReq("/api/admin/ai"))).status).toBe(403);
    await login(admin.id);
    const result = await settings(nextReq("/api/admin/ai"));
    const text = await result.text();
    expect(result.status).toBe(200);
    expect(text).not.toContain("fixture-secret-key");
    expect(text).not.toContain("encryptedKey");
  });
  it("probes before saving; rejects failed probes and preserves a key on editing", async () => {
    await login(admin.id);
    const input = {
      label: "new",
      kind: "gemini",
      baseUrl: "https://gw.example/google/v1beta/models",
      model: "fixture",
      apiKey: "other-key",
    };
    vi.mocked(probeProvider).mockRejectedValueOnce(
      new Error("secret upstream response"),
    );
    const failure = await saveProvider(send("/api/admin/ai", input, "PUT"));
    expect(failure.status).toBe(502);
    expect(await failure.text()).not.toContain("secret upstream");
    expect(await db.aiProvider.count()).toBe(1);
    const result = await saveProvider(
      send(
        "/api/admin/ai",
        { ...input, id: provider.id, apiKey: undefined },
        "PUT",
      ),
    );
    expect(result.status).toBe(200);
    expect(
      (await db.aiProvider.findUniqueOrThrow({ where: { id: provider.id } }))
        .encryptedKey,
    ).toBe(provider.encryptedKey);
    expect(vi.mocked(probeProvider).mock.calls.at(-1)?.[0].baseUrl).toBe(
      "https://gw.example/google/v1beta",
    );
  });
  it("enforces explicit grants regardless of athlete subscription and prevents provider switching", async () => {
    await db.user.update({
      where: { id: member.id },
      data: { tier: "vip_plus" },
    });
    await login(member.id);
    expect(
      (await chat(send("/api/ai/chat", { message: "برنامه" }))).status,
    ).toBe(403);
    await login(admin.id);
    expect(
      (
        await grantAccess(
          send(
            "/api/admin/ai",
            {
              userId: member.id,
              providerId: provider.id,
              enabled: true,
              dailyLimit: 2,
              monthlyLimit: 5,
            },
            "PATCH",
          ),
        )
      ).status,
    ).toBe(200);
    await login(member.id);
    expect(
      (
        await chat(
          send("/api/ai/chat", {
            message: "برنامه",
            providerId: "someone-else",
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await chat(send("/api/ai/chat", { message: "تمرین" }))).status,
    ).toBe(200);
    await db.aiGrant.update({
      where: { userId: member.id },
      data: { enabled: false },
    });
    expect(
      (await chat(send("/api/ai/chat", { message: "تمرین" }))).status,
    ).toBe(403);
  });
  it("blocks disabled providers and invalid grant limits", async () => {
    await grant(coach.id);
    await login(coach.id);
    await db.aiProvider.update({
      where: { id: provider.id },
      data: { enabled: false },
    });
    expect(
      (await chat(send("/api/ai/chat", { message: "ورزشکارانم" }))).status,
    ).toBe(403);
    await login(admin.id);
    expect(
      (
        await grantAccess(
          send(
            "/api/admin/ai",
            {
              userId: member.id,
              providerId: provider.id,
              enabled: true,
              dailyLimit: -1,
              monthlyLimit: 5,
            },
            "PATCH",
          ),
        )
      ).status,
    ).toBe(400);
  });
});
describe("quotas and private history", () => {
  it("serializes concurrent quota reservations, counts month use and releases failed requests", async () => {
    const params = {
      userId: member.id,
      timezone: "Asia/Tehran",
      limit: 2,
      monthlyLimit: 4,
    };
    const claims = await Promise.all(
      Array.from({ length: 7 }, () => claimAiQuotaSlot(params)),
    );
    expect(claims.filter((claim) => claim.ok)).toHaveLength(2);
    const first = claims.find((claim) => claim.ok)!;
    if (!first.ok) throw new Error("no claim");
    await releaseAiQuotaSlot(first.requestId);
    expect((await claimAiQuotaSlot(params)).ok).toBe(true);
    await db.aiUsageLog.deleteMany();
    await db.aiUsageLog.create({
      data: {
        userId: member.id,
        status: "success",
        dayKey: todayISO("Asia/Tehran"),
      },
    });
    expect((await claimAiQuotaSlot({ ...params, monthlyLimit: 1 })).ok).toBe(
      false,
    );
  });
  it("does not bill a failed provider and stores actual token use on success", async () => {
    await grant(member.id);
    await login(member.id);
    mockModel(true);
    expect(
      (await chat(send("/api/ai/chat", { message: "تمرین" }))).status,
    ).toBe(502);
    expect(await db.aiUsageLog.count({ where: { status: "pending" } })).toBe(0);
    expect(await db.aiUsageLog.count({ where: { status: "success" } })).toBe(0);
    mockModel();
    const result = await chat(send("/api/ai/chat", { message: "تغذیه" }));
    expect(result.status).toBe(200);
    const log = await db.aiUsageLog.findFirstOrThrow({
      where: { status: "success" },
    });
    expect(log.totalTokens).toBe(32);
    expect(log.provider).toBe(provider.id);
  });
  it("restores own history and rejects another user's conversation", async () => {
    await grant(member.id);
    await login(member.id);
    const result = await (
      await chat(send("/api/ai/chat", { message: "حرکت اسکوات" }))
    ).json();
    const loaded = await (
      await chatState(
        nextReq(`/api/ai/chat?conversationId=${result.conversationId}`),
      )
    ).json();
    expect(loaded.messages).toHaveLength(2);
    expect(loaded.quota.used).toBe(1);
    await grant(coach.id);
    await login(coach.id);
    expect(
      (
        await chatState(
          nextReq(`/api/ai/chat?conversationId=${result.conversationId}`),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await chat(
          send("/api/ai/chat", {
            message: "ورزش",
            conversationId: result.conversationId,
          }),
        )
      ).status,
    ).toBe(404);
  });
});
describe("reviewable role-scoped actions", () => {
  it("does not mutate before confirmation, reuses manual guardrails, and executes once", async () => {
    const actor = await login(admin.id);
    const thread = await conversation(admin.id);
    const action = await proposeAction(actor, thread.id, {
      kind: "update_user",
      userId: member.id,
      status: "suspended",
    });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: member.id } })).status,
    ).toBe("active");
    expect(action.preview).toContain(member.id);
    const payload = { id: action.id, confirm: true };
    const results = await Promise.all([
      confirm(send("/api/ai/actions", payload)),
      confirm(send("/api/ai/actions", payload)),
    ]);
    expect(results.some((result) => result.status === 200)).toBe(true);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: member.id } })).status,
    ).toBe("suspended");
    expect(await db.notification.count({ where: { userId: member.id } })).toBe(
      1,
    );
    expect((await confirm(send("/api/ai/actions", payload))).status).toBe(200);
    expect(await db.notification.count({ where: { userId: member.id } })).toBe(
      1,
    );
  });
  it("binds approvals to actor, role, unchanged target state, and expiry", async () => {
    const actor = await login(admin.id);
    const thread = await conversation(admin.id);
    const action = await proposeAction(actor, thread.id, {
      kind: "update_user",
      userId: member.id,
      tier: "vip",
    });
    await grant(coach.id);
    await login(coach.id);
    expect(
      (await confirm(send("/api/ai/actions", { id: action.id, confirm: true })))
        .status,
    ).toBe(404);
    await login(admin.id);
    await db.user.update({
      where: { id: member.id },
      data: { displayName: "changed" },
    });
    expect(
      (await confirm(send("/api/ai/actions", { id: action.id, confirm: true })))
        .status,
    ).toBe(409);
    const fresh = await proposeAction(actor, thread.id, {
      kind: "update_user",
      userId: member.id,
      tier: "vip",
    });
    await db.aiAction.update({
      where: { id: fresh.id },
      data: { expiresAt: new Date(0) },
    });
    expect(
      (await confirm(send("/api/ai/actions", { id: fresh.id, confirm: true })))
        .status,
    ).toBe(409);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: member.id } })).tier,
    ).toBe("free");
  });
  it("supports cancellation and refuses admin promotion through model inputs", async () => {
    const actor = await login(admin.id);
    const thread = await conversation(admin.id);
    await expect(
      proposeAction(actor, thread.id, {
        kind: "update_user",
        userId: member.id,
        role: "admin",
      }),
    ).rejects.toThrow();
    const action = await proposeAction(actor, thread.id, {
      kind: "update_user",
      userId: member.id,
      tier: "vip",
    });
    await confirm(send("/api/ai/actions", { id: action.id, confirm: false }));
    await confirm(send("/api/ai/actions", { id: action.id, confirm: true }));
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: member.id } })).tier,
    ).toBe("free");
  });
  it("allows coach plan assignment only for active roster, including rechecking at confirmation", async () => {
    await grant(coach.id);
    const actor = await login(coach.id);
    const thread = await conversation(coach.id, "coach");
    const input = {
      kind: "assign_plan",
      athleteId: member.id,
      template: "upper_lower",
      note: "یادداشت مربی",
    };
    await expect(proposeAction(actor, thread.id, input)).rejects.toThrow();
    await db.coachClient.create({
      data: { coachId: coach.id, athleteId: member.id },
    });
    const action = await proposeAction(actor, thread.id, input);
    expect(
      (await confirm(send("/api/ai/actions", { id: action.id, confirm: true })))
        .status,
    ).toBe(200);
    expect(await db.workoutPlan.count({ where: { userId: member.id } })).toBe(
      1,
    );
    const next = await proposeAction(actor, thread.id, input, "next-request");
    await db.coachClient.updateMany({ data: { status: "inactive" } });
    expect(
      (await confirm(send("/api/ai/actions", { id: next.id, confirm: true })))
        .status,
    ).toBe(403);
    await expect(
      proposeAction(actor, thread.id, {
        kind: "update_user",
        userId: member.id,
        tier: "vip",
      }),
    ).rejects.toThrow();
  });
});

describe("SDK tool execution boundary", () => {
  it("cancels proposals from an interrupted turn without charging or mutating", async () => {
    await login(admin.id);
    let step = 0;
    vi.mocked(configuredModel).mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: async () => {
          if (step++ > 0)
            throw new Error("gateway disconnected after tool result");
          return {
            content: [
              {
                type: "tool-call",
                toolCallId: "proposal-1",
                toolName: "propose_change",
                input: JSON.stringify({
                  action: {
                    kind: "update_user",
                    userId: member.id,
                    status: "suspended",
                  },
                }),
              },
            ],
            finishReason: { unified: "tool-calls", raw: undefined },
            usage: {
              inputTokens: {
                total: 10,
                noCache: 10,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: 10, text: 10, reasoning: undefined },
            },
            warnings: [],
          };
        },
      }),
    );
    const result = await chat(
      send("/api/ai/chat", { message: "حساب این ورزشکار را معلق کن" }),
    );
    expect(result.status).toBe(502);
    const actions = await db.aiAction.findMany();
    expect(actions).toHaveLength(1);
    expect(actions[0].status).toBe("cancelled");
    expect(actions[0].requestId).toBeTruthy();
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: member.id } })).status,
    ).toBe("active");
    expect(await db.aiUsageLog.count({ where: { status: "success" } })).toBe(0);
  });
  it("withholds staff tools and private athlete reads from other roles", async () => {
    const actor = await login(member.id);
    const thread = await conversation(member.id, "member");
    const tools = assistantTools(actor, thread.id, "fixture");
    expect(tools.propose_change).toBeUndefined();
    await db.userProfile.update({
      where: { userId: member.id },
      data: { heightCm: 175 },
    });
    await db.userProfile.update({
      where: { userId: coach.id },
      data: { heightCm: 999 },
    });
    const food = await db.food.create({
      data: {
        slug: "ai-fixture-food",
        nameFa: "غذای آزمایشی",
        calories: 200,
        proteinG: 17,
        carbsG: 20,
        fatG: 7,
      },
    });
    await db.nutritionDay.create({
      data: {
        userId: member.id,
        logDate: todayISO(),
        entries: {
          create: { foodId: food.id, mealSlot: "lunch", quantity: 1 },
        },
      },
    });
    const self = await tools.read_esifit.execute!(
      { section: "self", athleteId: coach.id, query: "" },
      { toolCallId: "self", messages: [], context: {} },
    );
    expect(self).toMatchObject({ ok: true });
    expect(JSON.stringify(self)).toContain("غذای آزمایشی");
    expect(JSON.stringify(self)).toContain("175");
    expect(JSON.stringify(self)).not.toContain("999");

    const result = await tools.read_esifit.execute!(
      { section: "athlete", athleteId: coach.id, query: "" },
      { toolCallId: "read1", messages: [], context: {} },
    );
    expect(result).toMatchObject({ ok: false });
    const trainer = await login(coach.id);
    const coachTools = assistantTools(trainer, thread.id, "fixture2");
    const denied = await coachTools.read_esifit.execute!(
      { section: "athlete", athleteId: member.id, query: "" },
      { toolCallId: "read2", messages: [], context: {} },
    );
    expect(denied).toMatchObject({ ok: false });
  });
});
