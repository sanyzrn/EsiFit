import { z } from "zod";
import { grantInput } from "./provider-config";

const contentBlock = z.discriminatedUnion("type",[
 z.object({type:z.enum(["p","h2","h3"]),text:z.string().min(1).max(1500)}).strict(),
 z.object({type:z.enum(["list","steps"]),items:z.array(z.string().min(1).max(500)).min(1).max(12)}).strict(),
 z.object({type:z.literal("callout"),title:z.string().max(120),text:z.string().max(1000)}).strict(),
]);

export const actionInput = z.discriminatedUnion("kind", [
 z.object({kind:z.literal("edit_product"),id:z.string().min(1),nameFa:z.string().trim().min(2).max(150).optional(),description:z.string().max(1500).optional(),priceToman:z.number().int().min(0).max(2000000000).optional(),stock:z.number().int().min(0).max(1000000).optional(),status:z.enum(["active","sold_out","archived"]).optional()}).strict(),
 z.object({kind:z.literal("edit_article"),id:z.string().min(1),title:z.string().trim().min(3).max(150).optional(),excerpt:z.string().min(10).max(500).optional(),status:z.enum(["draft","review","published","archived"]).optional(),contentBlocks:z.array(contentBlock).min(1).max(20).optional(),sources:z.array(z.object({title:z.string().min(2).max(150),publisher:z.string().min(2).max(100),url:z.url().refine(s=>s.startsWith("https://")),sourceType:z.enum(["organization","guideline","research"])}).strict()).min(1).max(8).optional()}).strict().refine(x=>!x.contentBlocks||JSON.stringify(x.contentBlocks).length<=12000,"متن پیشنهادی بیش از حد بلند است؛ ویرایش را بخش‌بندی کن."),
 z.object({kind:z.literal("edit_subscription_plan"),id:z.string().min(1),nameFa:z.string().trim().min(2).max(100).optional(),priceToman:z.number().int().min(0).max(2000000000).optional(),active:z.boolean().optional(),featuresFa:z.array(z.string().min(1).max(200)).max(12).optional()}).strict(),

  z
    .object({
      kind: z.literal("update_user"),
      userId: z.string().min(1),
      role: z.enum(["member", "coach"]).optional(),
      tier: z.enum(["free", "vip", "vip_plus"]).optional(),
      status: z.enum(["active", "suspended"]).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("assign_coach"),
      athleteId: z.string().min(1),
      coachId: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("moderate"),
      id: z.string().min(1),
      contentKind: z.enum(["post", "comment"]),
      reason: z.string().max(200),
    })
    .strict(),
  grantInput.extend({ kind: z.literal("grant_ai") }).strict(),
  z
    .object({ kind: z.literal("disable_provider"), id: z.string().min(1) })
    .strict(),
  z
    .object({
      kind: z.literal("assign_plan"),
      athleteId: z.string().min(1),
      template: z.enum(["ppl", "upper_lower"]),
      note: z.string().max(300),
    })
    .strict(),
]);
export type ActionInput = z.infer<typeof actionInput>;

export const readInput = z.object({
  section: z.enum([
    "self",
    "exercises",
    "roster",
    "athlete",
    "overview",
    "users",
    "moderation",
    "assignments",
    "ai_settings",
    "actions",
    "reports",
    "products",
    "articles",
    "plans",
    "planning",
  ]),
  query: z.string().max(100).default(""),
  athleteId: z.string().default(""),
});
export const proposalInput = z.object({ action: actionInput });
