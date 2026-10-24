import { z } from "zod";
import { grantInput } from "./provider-config";

export const actionInput = z.discriminatedUnion("kind", [
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
  ]),
  query: z.string().max(100).default(""),
  athleteId: z.string().default(""),
});
export const proposalInput = z.object({ action: actionInput });
