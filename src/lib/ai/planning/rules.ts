import type { CoachProgramDraft } from "@/lib/coach/program-contract";
import { planDraftInput } from "./contract";
import { PLAN_PRESETS, type PlanTemplateKey } from "@/lib/workout/plan-presets";
import { parseAvailableEquipment } from "@/lib/workout/equipment";
export type PlanningMovement = { id:string; slug:string; nameFa:string; equipment:string; movementPattern:string; difficulty:string; primaryMuscles:string[] };
export type PlanningContext = {
  age:number|null; sex:string|null; heightCm:number|null; weightKg:number|null;
  goal:string|null; level:string|null; days:number; minutes:number; equipment:string;
  medicalReviewRequired:boolean; healthNotes:string; pains:Array<{bodyRegion:string;severity:number;note:string}>;
  readiness:{score:number;date:string}|null;
  recentWorkouts:Array<{date:string;volume:number;duration:number|null;exercises:Array<{slug:string;sets:Array<{reps:number|null;weightKg:number|null;rpe:number|null}>}>}>;
  activePlan:{id:string;name:string;days:Array<{name:string;isRest:boolean;exercises:Array<{slug:string;sets:number;repsMin:number;repsMax:number}>}>}|null;
};
export function reviewReasons(c:Pick<PlanningContext,"age"|"heightCm"|"weightKg"|"goal"|"level"|"medicalReviewRequired"|"healthNotes"|"pains">):string[] {
  const reasons:string[]=[];
  if(c.age==null || c.heightCm==null || c.weightKg==null || !c.goal || !c.level)reasons.push("اطلاعات پایهٔ پرونده کامل نیست؛ ابتدا پروفایل را تکمیل کن.");
  if(c.age!=null&&(c.age<18||c.age>=65))reasons.push("برنامه‌ریزی خودکار این نسخه برای ۱۸ تا ۶۴ سال است؛ برنامهٔ شما به بررسی انسانی نیاز دارد.");
  if(c.medicalReviewRequired||c.healthNotes.trim())reasons.push("محدودیت پزشکی یا شرایط ویژه در پرونده ثبت شده؛ برنامه باید توسط متخصص/مربی صلاحیت‌دار بررسی شود.");
  if(c.pains.length)reasons.push("درد یا مصدومیت فعال ثبت شده؛ تولید و فعال‌سازی خودکار تا بررسی انسانی متوقف است.");
  if(c.heightCm&&c.weightKg){const bmi=c.weightKg/(c.heightCm/100)**2;if(bmi<16||bmi>=40||(bmi<18.5&&c.goal==='lose_weight'))reasons.push("تناسب قد، وزن یا هدف ثبت‌شده خارج از محدودهٔ برنامه‌ریز عمومی است؛ بررسی فردی لازم است.");}
  return reasons;
}
export function requestNeedsReview(reason:string):boolean {
  return /(?:^|\s)(?:درد|آسیب|مصدوم|جراحی|باردار|زایمان|قلبی|تنگی[\s‌]*نفس|بیهوش|pain|injur|surgery|pregnan|dizz)/i.test(reason);
}
export const levelDayLimit=(level:string|null)=>level==='advanced'?6:level==='intermediate'?4:3;
export function allowedMovements(c:PlanningContext,catalog:PlanningMovement[]) {
  const eq=parseAvailableEquipment(c.equipment);
  return catalog.filter(e=>(!eq||eq.has(e.equipment)) && (c.level==='advanced'||e.difficulty!=='advanced') &&
    (!eq||!['pull-up','chin-up','inverted-row','hanging-leg-raise','leg-raise-machine'].includes(e.slug)));
}
export function estimatedMinutes(day:CoachProgramDraft['days'][number]) {
  if(day.isRest)return 0;
  return Math.ceil((300+day.exercises.reduce((sum,e)=>sum+e.sets*(Math.max(30,e.repsMax*4)+e.rest),0))/60);
}
/** Hard product bounds, not a medical certification. Unknown exercises never reach storage. */
export function validatePlanningDraft(raw:unknown,c:PlanningContext,catalog:PlanningMovement[]):CoachProgramDraft {
  const p=planDraftInput.parse(raw);
  if(reviewReasons(c).length)throw new Error("Human review required");
  const allowed=new Map(allowedMovements(c,catalog).map(e=>[e.slug,e]));
  if(p.goalType!==c.goal || p.weeks>4)throw new Error("Goal or duration mismatch");
  const count=p.days.filter(d=>!d.isRest).length;
  if(count!==Math.min(c.days,levelDayLimit(c.level)))throw new Error("Schedule mismatch");
  if(c.level==='beginner')for(let i=0;i<7;i++)if([0,1,2].every(offset=>!p.days[(i+offset)%7].isRest))throw new Error("Beginner recovery spacing");
  const patterns=new Set(p.days.flatMap(d=>d.exercises.map(e=>allowed.get(e.slug)?.movementPattern)));
  if(patterns.size<3)throw new Error("Insufficient movement variety");
  for(const day of p.days){
    if(day.exercises.length>(c.level==='beginner'?6:8)||estimatedMinutes(day)>c.minutes)throw new Error("Session budget exceeded");
    for(const e of day.exercises){
      if(!allowed.has(e.slug)||e.sets>(c.level==='beginner'?3:5)||e.rpe>(c.level==='beginner'?7.5:8.5)||e.rest<30)throw new Error("Prescription outside bounds");
    }
  }
  return p;
}
/** Existing curated presets are adapted and labelled rules-based, never presented as AI. */
export function rulesDraft(c:PlanningContext,catalog:PlanningMovement[]):CoachProgramDraft|null {
  if(reviewReasons(c).length)return null;
  const count=Math.min(c.days,levelDayLimit(c.level));
  const key:PlanTemplateKey=count===2?'full_body_2':count===4?'upper_lower_4':count===5?'upper_lower':count===6?'ppl_6':'full_body_3';
  const allowed=allowedMovements(c,catalog);
  const days=structuredClone(PLAN_PRESETS[key].days);
  for(const d of days){
    if(d.isRest){d.exercises=[];continue;}
    const selected=new Set<string>();
    d.exercises=d.exercises.flatMap(e=>{
      const original=catalog.find(x=>x.slug===e.slug);
      const replacement=allowed.find(x=>x.slug===e.slug&&!selected.has(x.slug))??allowed.find(x=>!selected.has(x.slug)&&x.movementPattern===original?.movementPattern&&x.primaryMuscles.some(m=>original?.primaryMuscles.includes(m)))??allowed.find(x=>!selected.has(x.slug)&&x.primaryMuscles.some(m=>original?.primaryMuscles.includes(m)));
      if(!replacement)return [];
      selected.add(replacement.slug);
      return [{...e,slug:replacement.slug,sets:2,rpe:6.5,rest:Math.max(60,Math.min(120,e.rest)),note:e.repsMax===1?'هر ست ۲۰ ثانیه با کنترل؛ در صورت ناراحتی توقف کن.':'با اجرای کنترل‌شده؛ افزایش وزنه خودکار نیست.'}];
    }).slice(0,5);
    while(estimatedMinutes(d)>c.minutes && d.exercises.length>2)d.exercises.pop();
    if(d.exercises.length<2)return null;
  }
  try{return validatePlanningDraft({name:'پیشنهاد پایهٔ اسی‌فیت',description:'پیشنهاد مبتنی بر قواعد و الگوهای مرورشده؛ ساختهٔ مدل هوش مصنوعی نیست. فشار تمرین در این دوره خودکار افزایش نمی‌یابد.',goalType:c.goal,weeks:4,days},c,catalog);}catch{return null;}
}
