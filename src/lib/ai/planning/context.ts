import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { ageEstimateFromBirthYear } from "@/lib/domain/body-math";
import type { PlanningContext } from "./rules";
type Reader=Pick<Prisma.TransactionClient,'user'|'userProfile'|'bodyMeasurement'|'painReport'|'readinessDaily'|'workoutPlan'|'workoutSession'>;
export async function planningSnapshot(athleteId:string,reader:Reader=db) {
  const [athlete,profile,weight,pains,readiness,plan,sessions,live]=await Promise.all([
    reader.user.findFirst({where:{id:athleteId,role:'member',status:'active'},select:{id:true,timezone:true}}),
    reader.userProfile.findUnique({where:{userId:athleteId}}),
    reader.bodyMeasurement.findFirst({where:{userId:athleteId,weightKg:{not:null}},orderBy:{measuredOn:'desc'},select:{weightKg:true}}),
    reader.painReport.findMany({where:{userId:athleteId,status:{in:['active','improving']}},orderBy:[{reportedOn:'desc'},{id:'asc'}],take:30,select:{bodyRegion:true,severity:true,note:true}}),
    reader.readinessDaily.findFirst({where:{userId:athleteId},orderBy:{scoreDate:'desc'},select:{score:true,scoreDate:true}}),
    reader.workoutPlan.findFirst({where:{userId:athleteId,status:'active'},orderBy:{createdAt:'desc'},include:{days:{where:{weekNumber:1},orderBy:{dayNumber:'asc'},include:{exercises:{orderBy:{orderIndex:'asc'},include:{exercise:{select:{slug:true}}}}}}}}),
    reader.workoutSession.findMany({where:{userId:athleteId,status:'completed'},orderBy:{startedAt:'desc'},take:5,select:{startedAt:true,totalVolumeKg:true,durationSeconds:true,exerciseLogs:{take:8,orderBy:{orderIndex:"asc"},select:{exercise:{select:{slug:true}},sets:{where:{isWarmup:false},orderBy:{setNumber:"desc"},take:4,select:{reps:true,weightKg:true,rpe:true}}}}}}),
    reader.workoutSession.findFirst({where:{userId:athleteId,status:{in:['active','paused']}},select:{id:true}}),
  ]);
  if(!athlete)throw AppError.from('not_found');
  const year=profile?.birthYear;
  const context:PlanningContext={
    age:year?ageEstimateFromBirthYear(year):null,
    sex:profile?.sexAtBirth??null,heightCm:profile?.heightCm??null,weightKg:weight?.weightKg??null,
    goal:profile?.primaryGoal??null,level:profile?.experienceLevel??null,days:Math.max(2,Math.min(6,profile?.weeklyWorkoutTarget??3)),minutes:profile?.workoutMinutes??45,equipment:profile?.availableEquipment??'',
    medicalReviewRequired:profile?.medicalReviewRequired??false,healthNotes:(profile?.healthNotes??'').slice(0,500),pains:pains.map(p=>({...p,note:p.note.slice(0,300)})),
    readiness:readiness?{score:readiness.score,date:readiness.scoreDate}:null,
    recentWorkouts:sessions.map(s=>({date:s.startedAt.toISOString(),volume:s.totalVolumeKg,duration:s.durationSeconds,exercises:s.exerciseLogs.map(e=>({slug:e.exercise.slug,sets:e.sets}))})),
    activePlan:plan?{id:plan.id,name:plan.name,days:plan.days.map(d=>({name:d.name,isRest:d.isRestDay,exercises:d.exercises.map(e=>({slug:e.exercise.slug,sets:e.targetSets,repsMin:e.targetRepsMin,repsMax:e.targetRepsMax}))}))}:null,
  };
  const hash=createHash('sha256').update(JSON.stringify({context,live:live?.id??null})).digest('hex');
  return {athlete,context,hash,liveSessionId:live?.id??null};
}
