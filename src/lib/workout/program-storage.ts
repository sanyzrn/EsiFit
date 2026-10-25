import "server-only";
import type { Prisma } from "@prisma/client";
import { todayISO } from "@/lib/dates/jalali";
import { AppError } from "@/lib/errors/app-error";
import { parseAvailableEquipment } from "./equipment";
import type { CoachProgramDraft } from "@/lib/coach/program-contract";
/** Callers lock the athlete User row and establish authorization before entering. */
export async function storeWorkoutProgram(tx:Prisma.TransactionClient, athlete:{id:string;timezone:string}, draft:CoachProgramDraft) {
  const profile=await tx.userProfile.findUnique({where:{userId:athlete.id}});
  const equipment=parseAvailableEquipment(profile?.availableEquipment);
  const slugs=[...new Set(draft.days.flatMap(d=>d.exercises.map(e=>e.slug)))];
  const movements=await tx.exercise.findMany({where:{slug:{in:slugs}}});
  const bySlug=new Map(movements.map(e=>[e.slug,e]));
  for(const slug of slugs){const e=bySlug.get(slug);if(!e || (equipment&&!equipment.has(e.equipment)))throw AppError.from("validation","یک حرکت موجود نیست یا با وسایل ورزشکار سازگار نیست.");}
  await tx.workoutPlan.updateMany({where:{userId:athlete.id,status:"active"},data:{status:"archived"}});
  const plan=await tx.workoutPlan.create({data:{userId:athlete.id,name:draft.name,goalType:draft.goalType,description:draft.description,weeks:draft.weeks,startsOn:todayISO(athlete.timezone),status:"active"}});
  await tx.userProfile.upsert({where:{userId:athlete.id},create:{userId:athlete.id,weeklyWorkoutTarget:draft.days.filter(d=>!d.isRest).length},update:{weeklyWorkoutTarget:draft.days.filter(d=>!d.isRest).length}});
  for(let weekNumber=1;weekNumber<=draft.weeks;weekNumber++)for(const [i,d] of draft.days.entries()){
    const day=await tx.workoutPlanDay.create({data:{planId:plan.id,weekNumber,dayNumber:i+1,name:d.name,focusRegion:d.focusRegion,isRestDay:Boolean(d.isRest)}});
    if(d.exercises.length)await tx.plannedExercise.createMany({data:d.exercises.map((e,orderIndex)=>({planDayId:day.id,exerciseId:bySlug.get(e.slug)!.id,orderIndex,targetSets:e.sets,targetRepsMin:e.repsMin,targetRepsMax:e.repsMax,targetRpe:e.rpe,restSeconds:e.rest,note:e.note??""}))});
  }
  return plan;
}
