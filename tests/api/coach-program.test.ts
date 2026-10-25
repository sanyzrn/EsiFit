import { beforeEach, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ensureSeed, createUser, db } from "../helpers/db";
import { clearCookies } from "../helpers/session-mock";
import { nextReq } from "../helpers/next-request";
import { createSession } from "@/lib/auth/session";
import { POST } from "@/app/api/coach/program/route";
import { PATCH } from "@/app/api/coach/note/route";
import { coachProgramInput, type CoachProgramInput } from "@/lib/coach/program-contract";
import { todayISO } from "@/lib/dates/jalali";
let coach: Awaited<ReturnType<typeof createUser>>, athlete: Awaited<ReturnType<typeof createUser>>;
let input:CoachProgramInput;
const request=(body:unknown)=>nextReq("/api/coach/program",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(async()=>{
 await ensureSeed();clearCookies();coach=await createUser("09121111001",{role:"coach"});athlete=await createUser("09121111002",{role:"member"});
 await db.coachClient.create({data:{coachId:coach.id,athleteId:athlete.id,note:"old"}});await createSession(coach.id,"test");
 input={athleteId:athlete.id,sourcePlanId:null,name:"برنامه اختصاصی",description:"نسخه بررسی‌شده",goalType:"health",weeks:2,days:Array.from({length:7},(_,i)=>({name:`روز ${i+1}`,focusRegion:"full_body",isRest:![0,3].includes(i),exercises:[0,3].includes(i)?[{slug:"push-up",sets:2,repsMin:8,repsMax:12,rpe:7,rest:90,note:"کنترل فرم"}]:[]}))};
});
it("stores reviewed prescriptions and target, preserves archived sessions and notifies atomically",async()=>{
 const old=await db.workoutPlan.create({data:{userId:athlete.id,name:"قدیمی",goalType:"health",weeks:4,startsOn:todayISO()}});
 const history=await db.workoutSession.create({data:{userId:athlete.id,status:"completed",name:"history",startedAt:new Date()}});input.sourcePlanId=old.id;
 const r=await POST(request(input));expect(r.status).toBe(200);const p=await r.json();
 expect((await db.workoutPlan.findUniqueOrThrow({where:{id:old.id}})).status).toBe("archived");
 expect(await db.workoutPlanDay.count({where:{planId:p.planId}})).toBe(14);
 expect(await db.workoutSession.findUnique({where:{id:history.id}})).not.toBeNull();
 expect((await db.userProfile.findUniqueOrThrow({where:{userId:athlete.id}})).weeklyWorkoutTarget).toBe(2);
 expect(await db.notification.count({where:{userId:athlete.id}})).toBe(1);
});
it("serializes competing assignments and rejects a stale baseline",async()=>{
 const responses=await Promise.all([POST(request(input)),POST(request(input))]);expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
 expect(await db.workoutPlan.count({where:{userId:athlete.id,status:"active"}})).toBe(1);expect(await db.notification.count()).toBe(1);
});
it("rejects another coach, a revoked relationship and member callers",async()=>{
 const foreign=await createUser("09121111003",{role:"member"});expect((await POST(request({...input,athleteId:foreign.id}))).status).toBe(403);
 await db.coachClient.updateMany({where:{coachId:coach.id},data:{status:"archived"}});expect((await POST(request(input))).status).toBe(403);
 clearCookies();await createSession(athlete.id,"test");expect((await POST(request(input))).status).toBe(403);expect(await db.workoutPlan.count()).toBe(0);
});
it("rejects unavailable or unknown movements without archiving the active program",async()=>{
 await db.userProfile.upsert({where:{userId:athlete.id},create:{userId:athlete.id,availableEquipment:'["band"]'},update:{availableEquipment:'["band"]'}});
 expect((await POST(request(input))).status).toBe(400);expect(await db.workoutPlan.count()).toBe(0);expect(await db.notification.count()).toBe(0);
 await db.userProfile.update({where:{userId:athlete.id},data:{availableEquipment:""}});input.days[0].exercises[0].slug="missing";
 expect((await POST(request(input))).status).toBe(400);expect(await db.workoutPlan.count()).toBe(0);
});
it("validates duplicates, rest days, repetition ranges and bounded volume",()=>{
 const duplicate=structuredClone(input);duplicate.days[0].exercises.push(duplicate.days[0].exercises[0]);expect(coachProgramInput.safeParse(duplicate).success).toBe(false);
 const bad=structuredClone(input);bad.days[0].exercises[0].repsMax=1;expect(coachProgramInput.safeParse(bad).success).toBe(false);
 expect(coachProgramInput.safeParse({...input,weeks:99}).success).toBe(false);
});
it("saves and clears only the coach's own private note without sending athlete messages",async()=>{
 const req=(athleteId:string,note:string)=>nextReq("/api/coach/note",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({athleteId,note})});
 expect((await PATCH(req(athlete.id,"پیگیری هفته بعد"))).status).toBe(200);expect((await PATCH(req(athlete.id,""))).status).toBe(200);
 expect((await db.coachClient.findFirstOrThrow()).note).toBe("");expect(await db.notification.count()).toBe(0);
 const other=await createUser("09121111004",{role:"member"});expect((await PATCH(req(other.id,"foreign"))).status).toBe(403);
});
it("adds catalogs idempotently while preserving existing food values and meal histories",async()=>{
 const food=await db.food.create({data:{slug:"lentils-cooked",nameFa:"existing private food",isPublic:false,calories:123,proteinG:9,carbsG:12,fatG:1}});
 const day=await db.nutritionDay.create({data:{userId:athlete.id,logDate:todayISO()}});await db.mealEntry.create({data:{nutritionDayId:day.id,foodId:food.id,mealSlot:"lunch"}});
 const sql=readFileSync("docs/sql/catalog_expansion_20261025.sql","utf8").replace(/^--.*$/gm, "").replace(/^BEGIN;$/m,"").replace(/^COMMIT;$/m,"").replaceAll('esifit."','"');
 const apply=async()=>{for(const s of sql.split(';').filter(s=>s.trim()))await db.$executeRawUnsafe(s);};
 await apply();const counts=[await db.exercise.count(),await db.food.count()];await apply();expect([await db.exercise.count(),await db.food.count()]).toEqual(counts);
 expect(counts).toEqual([100,140]);expect(await db.mealEntry.count()).toBe(1);expect(await db.food.findUnique({where:{id:food.id}})).toMatchObject({calories:123,isPublic:false,nameFa:"existing private food"});
});
