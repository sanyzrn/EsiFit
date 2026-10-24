import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUser, db, ensureSeed } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession } from "@/lib/auth/session";
import {
  GET as feed,
  POST as publish,
  DELETE as remove,
} from "@/app/api/community/feed/route";
import { POST as like } from "@/app/api/community/like/route";
import {
  GET as comments,
  POST as comment,
} from "@/app/api/community/comment/route";
import { GET as challenges } from "@/app/api/community/challenges/route";
import { addDaysISO, todayISO } from "@/lib/dates/jalali";

const send = (url: string, json: unknown, method = "POST") =>
  nextReq(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
let member: Awaited<ReturnType<typeof createUser>>;
beforeEach(async () => {
  await db.challenge.deleteMany();
  await ensureSeed();
  clearCookies();
  member = await createUser("09121110331");
  await createSession(member.id, "community-test");
});

afterEach(async () => {
  await db.challenge.deleteMany();
});

describe("community interactions", () => {
  it("paginates without repeating posts and restores the viewer's like", async () => {
    await db.post.createMany({
      data: Array.from({ length: 14 }, (_, index) => ({
        userId: member.id,
        content: `پست آزمایشی ${index}`,
      })),
    });
    const first = await (await feed(nextReq("/api/community/feed"))).json();
    expect(first.posts).toHaveLength(12);
    expect(first.nextCursor).toBeTypeOf("string");
    // Deleting the last row of a page must not break its continuation cursor.
    await db.post.delete({ where: { id: first.posts[11].id } });
    const second = await (
      await feed(nextReq(`/api/community/feed?cursor=${first.nextCursor}`))
    ).json();
    expect(second.posts).toHaveLength(2);
    expect(
      first.posts.some((post: { id: string }) =>
        second.posts.some((other: { id: string }) => post.id === other.id),
      ),
    ).toBe(false);
    const postId = first.posts[0].id;
    await like(send("/api/community/like", { postId, liked: true }));
    await like(send("/api/community/like", { postId, liked: true }));
    const refreshed = await (await feed(nextReq("/api/community/feed"))).json();
    expect(
      refreshed.posts.find((post: { id: string }) => post.id === postId),
    ).toMatchObject({ liked: true, likeCount: 1, isOwner: true });
  });

  it("validates whitespace, lists comments and prevents hidden-post interactions", async () => {
    expect(
      (await publish(send("/api/community/feed", { content: "   " }))).status,
    ).toBe(400);
    const p = await db.post.create({
      data: { userId: member.id, content: "پست آزمایشی" },
    });
    expect(
      (
        await comment(
          send("/api/community/comment", { postId: p.id, content: "  " }),
        )
      ).status,
    ).toBe(400);
    const written = await comment(
      send("/api/community/comment", { postId: p.id, content: "  عالی بود  " }),
    );
    expect(written.status).toBe(200);
    const page = await (
      await comments(nextReq(`/api/community/comment?postId=${p.id}&cursor=0`))
    ).json();
    expect(page.comments[0].content).toBe("عالی بود");
    await db.post.update({
      where: { id: p.id },
      data: { visibility: "private" },
    });
    expect(
      (await comments(nextReq(`/api/community/comment?postId=${p.id}`))).status,
    ).toBe(404);
    expect(
      (
        await comment(
          send("/api/community/comment", { postId: p.id, content: "نظر" }),
        )
      ).status,
    ).toBe(404);
    expect(
      (await like(send("/api/community/like", { postId: p.id, liked: true })))
        .status,
    ).toBe(404);
  });

  it("scopes deletion to the owner and cascades reactions/comments", async () => {
    const p = await db.post.create({
      data: { userId: member.id, content: "پست من" },
    });
    await comment(
      send("/api/community/comment", { postId: p.id, content: "نظر" }),
    );
    await like(send("/api/community/like", { postId: p.id, liked: true }));
    const stranger = await createUser("09121110332");
    clearCookies();
    await createSession(stranger.id, "stranger");
    expect(
      (await remove(send("/api/community/feed", { postId: p.id }, "DELETE")))
        .status,
    ).toBe(404);
    expect(await db.post.findUnique({ where: { id: p.id } })).not.toBeNull();
    clearCookies();
    await createSession(member.id, "owner");
    expect(
      (await remove(send("/api/community/feed", { postId: p.id }, "DELETE")))
        .status,
    ).toBe(200);
    expect(await db.comment.count({ where: { postId: p.id } })).toBe(0);
    expect(await db.postLike.count({ where: { postId: p.id } })).toBe(0);
  });

  it("keeps challenge membership visible below the top ten", async () => {
    const today = todayISO();
    const ch = await db.challenge.create({
      data: {
        slug: "test-membership",
        nameFa: "چالش تست",
        metric: "workouts",
        startDate: today,
        endDate: addDaysISO(today, 5),
      },
    });
    for (let index = 0; index < 11; index++) {
      const other = await createUser(
        `091211104${String(index).padStart(2, "0")}`,
      );
      await db.challengeParticipant.create({
        data: { challengeId: ch.id, userId: other.id, score: 100 + index },
      });
    }
    await db.challengeParticipant.create({
      data: { challengeId: ch.id, userId: member.id, score: 1 },
    });
    const result = await (await challenges()).json();
    expect(result.challenges[0]).toMatchObject({
      joined: true,
      myScore: 1,
      participantCount: 12,
    });
  });
});
