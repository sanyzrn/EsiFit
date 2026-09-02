import { describe, it, expect, beforeEach } from "vitest";
import { ensureSeed, createUser, db } from "../helpers/db";

/**
 * On MySQL a bare `String` becomes VARCHAR(191). Several columns hold content
 * far longer than that (article bodies, AI replies, JSON blobs), so the schema
 * marks them @db.Text / @db.LongText. Without those annotations writes are
 * truncated or rejected — and SQLite would never have caught it.
 */
beforeEach(async () => {
  await ensureSeed();
});

const long = (n: number) => "ا".repeat(n);

describe("long-text columns survive a round trip", () => {
  it("stores an article body far beyond VARCHAR(191)", async () => {
    const author = await db.author.create({ data: { name: "نویسنده تست" } });
    const category = await db.category.create({ data: { slug: "t-cat", nameFa: "تست" } });
    const body = JSON.stringify([{ type: "p", text: long(20000) }]);

    const article = await db.article.create({
      data: {
        slug: "long-body", title: "تست", contentType: "guide",
        authorId: author.id, categoryId: category.id,
        contentBlocks: body, excerpt: long(500), metaDescription: long(400),
      },
    });

    const read = await db.article.findUniqueOrThrow({ where: { id: article.id } });
    expect(read.contentBlocks).toHaveLength(body.length);
    expect(read.contentBlocks).toBe(body);
    expect(read.excerpt).toHaveLength(500);
    expect(read.metaDescription).toHaveLength(400);
  });

  it("stores a long AI reply and community post verbatim", async () => {
    const user = await createUser("09121110940");
    const conversation = await db.aiConversation.create({ data: { userId: user.id } });
    const reply = long(9000);

    const message = await db.aiMessage.create({
      data: { conversationId: conversation.id, role: "assistant", content: reply },
    });
    expect((await db.aiMessage.findUniqueOrThrow({ where: { id: message.id } })).content).toBe(reply);

    const post = await db.post.create({ data: { userId: user.id, content: long(480) } });
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).content).toHaveLength(480);
  });

  it("keeps indexed identifier columns narrow enough for MySQL to index", async () => {
    // Regression guard: making any of these TEXT breaks the unique index.
    const rows = await db.$queryRawUnsafe<Array<{ COLUMN_NAME: string; DATA_TYPE: string }>>(
      `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('User','Session','Exercise','Article')
         AND COLUMN_NAME IN ('phone','tokenHash','slug')`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.DATA_TYPE).toBe("varchar");
    }
  });
});
