import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";
import { appErrorResponse } from "@/lib/errors/respond";
import { readJson } from "@/lib/http/read-json";
import { rateLimit } from "@/lib/http/rate-limit";
import { resolveFeatureFlag } from "@/lib/feature-flags/registry";
import { planningRequest } from "@/lib/ai/planning/contract";
import { planningSnapshot } from "@/lib/ai/planning/context";
import { prepareTrainingPlan, applyTrainingPlan, requestHumanReview, authorizePlanningTarget, planningRunView } from "@/lib/ai/planning/service";
import { loadExerciseCatalog } from "@/lib/workout/catalog";
import { reviewReasons } from "@/lib/ai/planning/rules";
import { releaseAiQuotaSlot, countAiQuotaUsage } from "@/lib/ai/quota";
export const maxDuration=120;
async function actor(){const user=await getSessionUser();if(!user)throw AppError.from('authentication');return user;}
export async function GET(req:Request){try{
  const user=await actor();const url=new URL(req.url);const athleteId=url.searchParams.get('athleteId')||user.id;
  await authorizePlanningTarget(user,athleteId);
  const [snapshot,policy,catalog,profile,humanCoach]=await Promise.all([planningSnapshot(athleteId),db.aiPlanningPolicy.findUnique({where:{id:'default'}}),loadExerciseCatalog(),db.userProfile.findUnique({where:{userId:athleteId},select:{aiPlanningConsentAt:true}}),db.coachClient.findFirst({where:{athleteId,status:"active",coach:{role:"coach",status:"active"}},select:{id:true}})]);
  const run=await db.aiPlanRun.findFirst({where:{athleteId,...(url.searchParams.get('runId')?{id:url.searchParams.get('runId')!}:{})},orderBy:{createdAt:'desc'}});
  if(run?.status==='generating'&&run.createdAt.getTime()<Date.now()-120000){await db.aiPlanRun.updateMany({where:{id:run.id,status:'generating'},data:{status:'failed',failureCode:'interrupted'}});if(run.usageRequestId)await releaseAiQuotaSlot(run.usageRequestId);run.status='failed';run.failureCode='interrupted';}
  const provider=policy?.enabled&&policy.providerId?await db.aiProvider.findFirst({where:{id:policy.providerId,enabled:true},select:{label:true}}):null;
  const [used,monthUsed]=await Promise.all([countAiQuotaUsage(user.id,user.timezone,false,"planner"),countAiQuotaUsage(user.id,user.timezone,true,"planner")]);
  return NextResponse.json({ok:true,quota:{used,monthUsed,limit:policy?.dailyLimit??3,monthlyLimit:policy?.monthlyLimit??30},enabled:resolveFeatureFlag('AI_PLANNING'),aiAvailable:Boolean(provider),canApply:user.role!=="member"||!humanCoach,providerLabel:provider?.label??null,athleteConsent:Boolean(profile?.aiPlanningConsentAt),context:snapshot.context,risks:reviewReasons(snapshot.context),liveSession:Boolean(snapshot.liveSessionId),run:run?planningRunView(run):null,movements:catalog.map(e=>({slug:e.slug,nameFa:e.nameFa}))},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return appErrorResponse(e);}}
export async function POST(req:Request){try{
  const user=await actor();const input=planningRequest.parse(await readJson(req));
  const limit=await rateLimit(`planning:${user.id}`,5,60000);if(!limit.ok)throw new AppError('rate_limit',{retryAfterSeconds:limit.retryAfterSeconds});
  return NextResponse.json({ok:true,run:planningRunView(await prepareTrainingPlan(user,input))},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return appErrorResponse(e);}}
export async function PATCH(req:Request){try{
  const user=await actor();const {id,action}=z.object({id:z.string().min(1).optional(),action:z.enum(['apply','human_review','cancel','revoke_consent'])}).strict().parse(await readJson(req));
  if(action==='revoke_consent'){
    if(user.role!=='member')throw AppError.from('authorization');
    await db.$transaction(async tx=>{await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${user.id} FOR UPDATE`;await tx.userProfile.update({where:{userId:user.id},data:{aiPlanningConsentAt:null}});await tx.aiPlanRun.updateMany({where:{athleteId:user.id,status:{in:['ready','generating']},source:'ai'},data:{status:'cancelled'}});});
    return NextResponse.json({ok:true});
  }
  if(!id)throw AppError.from('validation');
  let run;
  if(action==='apply')run=await applyTrainingPlan(user,id);
  else if(action==='human_review'){
    const limit=await rateLimit(`planning-review:${user.id}`,5,3600000);if(!limit.ok)throw new AppError('rate_limit',{retryAfterSeconds:limit.retryAfterSeconds});
    run=await requestHumanReview(user,id);
  }else{
    const target=await db.aiPlanRun.findUnique({where:{id}});if(!target)throw AppError.from('not_found');await authorizePlanningTarget(user,target.athleteId);
    // A supervising coach may read a draft; discarding another actor's draft is not implied.
    if(target.actorId!==user.id)throw AppError.from('authorization');
    await db.aiPlanRun.updateMany({where:{id,status:{in:['ready','needs_review','failed']}},data:{status:'cancelled'}});run=await db.aiPlanRun.findUniqueOrThrow({where:{id}});
  }
  return NextResponse.json({ok:true,run:planningRunView(run)},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return appErrorResponse(e);}}
