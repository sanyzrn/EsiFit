import { z } from "zod";
import { programDraftSchema } from "@/lib/coach/program-contract";
export const planDraftInput = programDraftSchema;
export const planningOutput = z.object({ plan: planDraftInput, reasons: z.array(z.string().max(300)).min(1).max(6) }).strict();
export const planningRequest = z.object({ requestId: z.string().uuid(), athleteId: z.string().min(1).optional(), reason: z.string().trim().max(500).default(""), consent: z.literal(true), mode: z.enum(["ai","rules"]).default("ai") }).strict();
export const planningPolicyInput = z.object({ enabled: z.boolean(), providerId: z.string().min(1).nullable(), dailyLimit: z.number().int().min(1).max(20), monthlyLimit: z.number().int().min(1).max(300) }).strict().refine(v=>v.monthlyLimit>=v.dailyLimit,"سهمیه ماهانه نباید کمتر از روزانه باشد.");
export type PlanningOutput = z.infer<typeof planningOutput>;
export type PlanningRequest = z.infer<typeof planningRequest>;
export type PlanningRunView = { id:string; status:string; source:string; requestNote:string; plan:PlanningOutput["plan"]|null; reasons:string[]; risks:string[]; failureCode:string|null; appliedPlanId:string|null; reviewRequestedAt:string|null; expiresAt:string; createdAt:string };
