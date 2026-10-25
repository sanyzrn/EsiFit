import { beforeEach,it,expect,vi } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { randomUUID } from 'node:crypto';
import { ensureSeed,db,createUser } from '../helpers/db';
import { clearCookies } from '../helpers/session-mock';
import { nextReq } from '../helpers/next-request';
import { createSession,getSessionUser } from '@/lib/auth/session';
import { prepareTrainingPlan,applyTrainingPlan,requestHumanReview,authorizePlanningTarget } from '@/lib/ai/planning/service';
import { GET, PATCH } from '@/app/api/ai/planning/route';
import { configuredModel } from '@/lib/ai/provider';
import { countAiQuotaUsage } from '@/lib/ai/quota';
import { todayISO } from '@/lib/dates/jalali';
import type { SessionUser } from '@/lib/auth/session';
vi.mock('@/lib/ai/provider',async original=>({...await original<typeof import('@/lib/ai/provider')>(),configuredModel:vi.fn()}));
let actor:SessionUser;
beforeEach(async()=>{
 await ensureSeed();clearCookies();const user=await createUser('09121117700');
 await db.userProfile.update({where:{userId:user.id},data:{birthYear:1370,heightCm:180,sexAtBirth:'undisclosed',primaryGoal:'health',experienceLevel:'beginner',workoutMinutes:45}});
 await db.bodyMeasurement.create({data:{userId:user.id,measuredOn:todayISO(),weightKg:80}});
 await createSession(user.id,'planning-test');actor=(await getSessionUser())!;
});
const input=()=>({requestId:randomUUID(),mode:'rules' as const,consent:true as const,reason:''});
it('recovers the same draft and applies it once, preserving the old plan',async()=>{
 const old=await db.workoutPlan.create({data:{userId:actor.id,name:'old',goalType:'health',weeks:4,startsOn:todayISO()}});
 const request=input();const first=await prepareTrainingPlan(actor,request);expect(first.status).toBe('ready');expect(first.source).toBe('rules');
 expect((await prepareTrainingPlan(actor,request)).id).toBe(first.id);expect(await db.workoutPlan.count()).toBe(1);
 await prepareTrainingPlan(actor,input());const recovered=await GET(new Request(`https://esifit.internal/api/ai/planning?requestId=${request.requestId}`));expect((await recovered.json()).run.id).toBe(first.id);
 const [a,b]=await Promise.all([applyTrainingPlan(actor,first.id),applyTrainingPlan(actor,first.id)]);expect(a.appliedPlanId).toBe(b.appliedPlanId);
 expect(await db.workoutPlan.count({where:{status:'active'}})).toBe(1);expect((await db.workoutPlan.findUniqueOrThrow({where:{id:old.id}})).status).toBe('archived');
 expect(await db.notification.count()).toBe(1);
});
it('rejects foreign access and a stale profile without changing the active plan',async()=>{
 const run=await prepareTrainingPlan(actor,input());
 const other=await createUser('09121117701');await expect(authorizePlanningTarget(actor,other.id)).rejects.toMatchObject({code:'authorization'});
 await db.userProfile.update({where:{userId:actor.id},data:{workoutMinutes:30}});
 await expect(applyTrainingPlan(actor,run.id)).rejects.toMatchObject({code:'conflict'});expect(await db.workoutPlan.count()).toBe(0);
});
it('routes injury cases to one real in-app human review request without a model call',async()=>{
 const admin=await createUser('09121117702',{role:'admin'});await db.painReport.create({data:{userId:actor.id,reportedOn:todayISO(),bodyRegion:'knee',severity:3}});
 const run=await prepareTrainingPlan(actor,{...input(),mode:'ai'});expect(run.status).toBe('needs_review');expect(run.planJson).toBeNull();
 await requestHumanReview(actor,run.id);await requestHumanReview(actor,run.id);expect(await db.notification.count({where:{userId:admin.id}})).toBe(1);
 await expect(applyTrainingPlan(actor,run.id)).rejects.toMatchObject({code:'conflict'});
});
it('keeps fallback available on provider outage and meters planning separately from chat',async()=>{
 const p=await db.aiProvider.create({data:{label:'fixture',kind:'gemini',baseUrl:'https://example.org/v1beta',model:'fixture',encryptedKey:'unused',testedAt:new Date()}});
 await db.aiPlanningPolicy.create({data:{id:'default',enabled:true,providerId:p.id,dailyLimit:3,monthlyLimit:30}});
 vi.mocked(configuredModel).mockReturnValue(new MockLanguageModelV4({doGenerate:async()=>{throw new Error('fixture outage')}}));
 const run=await prepareTrainingPlan(actor,{...input(),mode:'ai'});expect(run.status).toBe('ready');expect(run.source).toBe('rules');expect(run.failureCode).toBe('provider_or_validation');
 expect(await countAiQuotaUsage(actor.id,actor.timezone)).toBe(0);expect(await countAiQuotaUsage(actor.id,actor.timezone,false,'planner')).toBe(0);
 expect(await db.aiUsageLog.count({where:{purpose:'planner',status:'failed'}})).toBe(1);expect(await db.workoutPlan.count()).toBe(0);
});
it('does not let an athlete overwrite a human coach program',async()=>{
 const coach=await createUser('09121117703',{role:'coach'});await db.coachClient.create({data:{athleteId:actor.id,coachId:coach.id}});
 const run=await prepareTrainingPlan(actor,input());await expect(applyTrainingPlan(actor,run.id)).rejects.toMatchObject({code:'authorization'});
});
it('recovers stalled requests and supports explicit consent revocation',async()=>{
 const run=await prepareTrainingPlan(actor,input());await db.aiPlanRun.update({where:{id:run.id},data:{status:'generating',createdAt:new Date(Date.now()-180000)}});
 const response=await GET(new Request('https://esifit.internal/api/ai/planning'));expect(response.status).toBe(200);expect((await response.json()).run.status).toBe('failed');
 await db.userProfile.update({where:{userId:actor.id},data:{aiPlanningConsentAt:new Date()}});
 const revoked=await PATCH(nextReq('/api/ai/planning',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revoke_consent'})}));expect(revoked.status).toBe(200);expect((await db.userProfile.findUniqueOrThrow({where:{userId:actor.id}})).aiPlanningConsentAt).toBeNull();
});
it('validates a real SDK structured-tool roundtrip and omits account identifiers',async()=>{
 const baseline=await prepareTrainingPlan(actor,input());const plan=JSON.parse(baseline.planJson!);plan.name='پیشنهاد هوشمند آزمایشی';plan.description='پیش‌نویس برای بازبینی';
 const p=await db.aiProvider.create({data:{label:'fixture',kind:'custom',baseUrl:'https://example.org/v1',model:'fixture',encryptedKey:'unused',testedAt:new Date()}});
 await db.aiPlanningPolicy.create({data:{id:'default',enabled:true,providerId:p.id,dailyLimit:3,monthlyLimit:30}});
 let prompt='';
 vi.mocked(configuredModel).mockReturnValue(new MockLanguageModelV4({doGenerate:async options=>{
   prompt=JSON.stringify(options.prompt);
   return {content:[{type:'tool-call',toolCallId:'draft-1',toolName:'submit_program',input:JSON.stringify({plan,reasons:['با زمان و وسایل پرونده تنظیم شده است.']})}],finishReason:{unified:'tool-calls',raw:undefined},usage:{inputTokens:{total:12,noCache:12,cacheRead:undefined,cacheWrite:undefined},outputTokens:{total:20,text:20,reasoning:undefined}},warnings:[]};
 }}));
 const run=await prepareTrainingPlan(actor,{...input(),mode:'ai'});expect(run.source).toBe('ai');expect(run.status).toBe('ready');expect(run.failureCode).toBeNull();
 expect(prompt).not.toContain(actor.id);expect(prompt).not.toContain(actor.phone);expect(await countAiQuotaUsage(actor.id,actor.timezone,false,'planner')).toBe(1);expect(await countAiQuotaUsage(actor.id,actor.timezone)).toBe(0);
});
