import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { appErrorResponse } from "@/lib/errors/respond";
import { readJson } from "@/lib/http/read-json";
import { planningPolicyInput } from "@/lib/ai/planning/contract";
export async function GET(){try{
  await requireRole('admin');
  const [policy,providers,recent,counts]=await Promise.all([
    db.aiPlanningPolicy.findUnique({where:{id:'default'}}),
    db.aiProvider.findMany({where:{enabled:true},select:{id:true,label:true,kind:true,model:true,testedAt:true},orderBy:{createdAt:'asc'}}),
    db.aiPlanRun.findMany({orderBy:{createdAt:'desc'},take:20,select:{id:true,status:true,source:true,createdAt:true,reviewRequestedAt:true,athlete:{select:{id:true,displayName:true}},failureCode:true}}),
    db.aiPlanRun.groupBy({by:['status','source'],_count:{_all:true}}),
  ]);
  return NextResponse.json({ok:true,policy:policy??{enabled:false,providerId:null,dailyLimit:3,monthlyLimit:30},providers,recent,counts},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return appErrorResponse(e);}}
export async function PUT(req:Request){try{
  const admin=await requireRole('admin');const input=planningPolicyInput.parse(await readJson(req));
  if(input.enabled&&(!input.providerId||!await db.aiProvider.findFirst({where:{id:input.providerId,enabled:true}})))throw AppError.from('validation','یک اتصال آزمایش‌شده و فعال را انتخاب کن.');
  const policy=await db.$transaction(async tx=>{
    const saved=await tx.aiPlanningPolicy.upsert({where:{id:'default'},create:{id:'default',...input},update:input});
    await tx.aiAction.create({data:{actorId:admin.id,actorRole:'admin',conversationId:'planning-settings',kind:'planning_policy',payloadJson:JSON.stringify(input),preview:`${input.enabled?'فعال‌سازی':'توقف'} برنامه‌ریز مستقل؛ سقف روزانه ${input.dailyLimit} و ماهانه ${input.monthlyLimit}`,status:'succeeded',expiresAt:new Date()}});
    return saved;
  });
  return NextResponse.json({ok:true,policy});
}catch(e){return appErrorResponse(e);}}
