import "server-only";
import { revalidateTag } from "next/cache";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import type { Prisma } from "@prisma/client";
import type { ActionInput } from "./tool-contracts";
export const actionFingerprint=(state:unknown)=>createHash('sha256').update(JSON.stringify(state)).digest('hex');
type RecordAction=Extract<ActionInput,{kind:'edit_product'|'edit_article'|'edit_subscription_plan'}>;
type Reader=Pick<Prisma.TransactionClient,'product'|'article'|'subscriptionPlan'>;
export async function describeRecordAction(input:RecordAction,reader:Reader=db){
  const state=input.kind==='edit_product'?await reader.product.findUnique({where:{id:input.id}}):input.kind==='edit_article'?await reader.article.findUnique({where:{id:input.id},include:{sources:{orderBy:{id:'asc'}}}}):await reader.subscriptionPlan.findUnique({where:{id:input.id}});
  if(!state)throw AppError.from('not_found');
  const fields:Record<string,string>={nameFa:'نام',description:'توضیحات',priceToman:'قیمت به تومان',stock:'موجودی',status:'وضعیت',title:'عنوان',excerpt:'خلاصه',contentBlocks:'متن مقاله',featuresFa:'ویژگی‌های اشتراک',active:'فعال',sources:'منابع'};
  const details=Object.entries(input).filter(([k])=>k!=='kind'&&k!=='id');
  if(!details.length)throw AppError.from('validation');
  const title='nameFa' in state?state.nameFa:'title' in state?state.title:input.id;
  const preview=`ویرایش ${input.kind==='edit_product'?'محصول':input.kind==='edit_article'?'مقاله':'پلن اشتراک'} «${title}» (${input.id})\n${details.map(([k,v])=>`${fields[k]??k} ← ${typeof v==='string'?v:JSON.stringify(v)}`).join('\n')}\n${input.kind==='edit_article'?'متن و منابع را پیش از تأیید و انتشار بازبینی کنید.':'تغییر فقط پس از تأیید همین مقادیر اجرا می‌شود.'}`;
  return {state,preview};
}
/** Recheck the exact record and sources under the same lock as the mutation. */
export async function executeRecordAction(input:RecordAction,snapshot:string){
  const result = await db.$transaction(async tx=>{
    if(input.kind==='edit_product')await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${input.id} FOR UPDATE`;
    else if(input.kind==='edit_article')await tx.$queryRaw`SELECT id FROM "Article" WHERE id=${input.id} FOR UPDATE`;
    else await tx.$queryRaw`SELECT id FROM "SubscriptionPlan" WHERE id=${input.id} FOR UPDATE`;
    const current=await describeRecordAction(input,tx);
    if(actionFingerprint(current.state)!==snapshot)throw AppError.from('conflict','اطلاعات از زمان پیشنهاد تغییر کرده؛ پیشنهاد تازه بگیر.');
    if(input.kind==='edit_product'){const {kind:_kind,id,...data}=input;await tx.product.update({where:{id},data});}
    else if(input.kind==='edit_subscription_plan'){const {kind:_kind,id,featuresFa,...data}=input;const plan=await tx.subscriptionPlan.findUniqueOrThrow({where:{id}});if(!['vip','vip_plus'].includes(plan.tier))throw AppError.from('validation','پلن مربی یا سطح ناشناخته قابل فروش نیست.');await tx.subscriptionPlan.update({where:{id},data:{...data,...(featuresFa?{featuresFa:JSON.stringify(featuresFa)}:{})}});}
    else{const {kind:_kind,id,contentBlocks,sources,...data}=input;await tx.article.update({where:{id},data:{...data,...(input.title?{metaTitle:input.title.slice(0,60)}:{}),...(input.excerpt?{metaDescription:input.excerpt.slice(0,155)}:{}),...(contentBlocks||sources?{reviewerId:null}:{}),...(contentBlocks?{contentBlocks:JSON.stringify(contentBlocks)}:{}),revision:{increment:1},revisionNote:'ویرایش با پیشنهاد همپا و تأیید مدیر'}});if(sources){await tx.articleSource.deleteMany({where:{articleId:id}});await tx.articleSource.createMany({data:sources.map(s=>({...s,articleId:id}))});}}
    return {ok:true,id:input.id};
  });
  if(input.kind==='edit_article')revalidateTag('public-editorial',{expire:0});
  return result;
}
export async function readOperationalReport(){
 const since=new Date(Date.now()-7*86400000);
 const [users,workouts,plans,articles,products,orders,ai,planning,unassigned]=await Promise.all([
  db.user.groupBy({by:['role','status'],_count:{_all:true}}),
  db.workoutSession.groupBy({by:['status'],where:{startedAt:{gte:since}},_count:{_all:true}}),
  db.subscriptionPlan.findMany({where:{active:true},select:{code:true,tier:true,priceToman:true}}),
  db.article.groupBy({by:['status'],_count:{_all:true}}),
  db.product.count({where:{status:'active',stock:{lte:5}}}),
  db.order.aggregate({where:{createdAt:{gte:since}},_count:{_all:true},_sum:{totalToman:true}}),
  db.aiUsageLog.groupBy({by:['purpose','status'],where:{createdAt:{gte:since}},_count:{_all:true},_sum:{totalTokens:true}}),
  db.aiPlanRun.groupBy({by:['status','source'],where:{createdAt:{gte:since}},_count:{_all:true}}),
  db.user.count({where:{role:'member',status:'active',coachClients:{none:{status:'active'}}}}),
 ]);
 return {activityWindow:'last_7_days',usersCurrentTotals:users,workoutsLast7Days:workouts,currentPlans:plans,articlesCurrentTotals:articles,lowStockProducts:products,ordersLast7Days:orders,aiLast7Days:ai,planningLast7Days:planning,athletesWithoutHumanCoach:unassigned,limits:'Order totals are sandbox records, not verified gateway revenue. No external outreach or arbitrary SQL tools are available.'};
}
