import { describe,it,expect } from 'vitest';
import { EXERCISES } from '@/features/workouts/data/exercise-dataset';
import { reviewReasons,requestNeedsReview,rulesDraft,validatePlanningDraft,allowedMovements,estimatedMinutes,type PlanningContext,type PlanningMovement } from '@/lib/ai/planning/rules';
const catalog:PlanningMovement[]=EXERCISES.map(e=>({id:e.slug,slug:e.slug,nameFa:e.nameFa,equipment:e.equipment,movementPattern:e.movementPattern,difficulty:e.difficulty,primaryMuscles:e.muscles.filter(m=>m.role==='primary').map(m=>m.slug)}));
const context:PlanningContext={age:35,sex:'undisclosed',heightCm:180,weightKg:80,goal:'health',level:'beginner',days:3,minutes:45,equipment:'',medicalReviewRequired:false,healthNotes:'',pains:[],readiness:null,recentWorkouts:[],activePlan:null};
describe('independent training planner constraints',()=>{
 it('requires human review for injuries, medical limitations, minors and missing metrics',()=>{
   expect(reviewReasons(context)).toEqual([]);
   for(const patch of [{age:17},{age:67},{weightKg:null},{medicalReviewRequired:true},{healthNotes:'medical limitation'},{pains:[{bodyRegion:'knee',severity:2,note:''}]}])expect(reviewReasons({...context,...patch}).length).toBeGreaterThan(0);
   expect(rulesDraft({...context,pains:[{bodyRegion:'knee',severity:2,note:''}]},catalog)).toBeNull();
 });
 it('produces a complete labelled fallback with allowed home equipment',()=>{
   const c={...context,equipment:'["bodyweight"]'};const p=rulesDraft(c,catalog);expect(p).not.toBeNull();expect(p?.days).toHaveLength(7);
   for(const d of p!.days){expect(estimatedMinutes(d)).toBeLessThanOrEqual(45);for(const e of d.exercises)expect(catalog.find(x=>x.slug===e.slug)?.equipment).toBe('bodyweight');}
   expect(allowedMovements(c,catalog).some(e=>e.slug==='pull-up')).toBe(false);
 });
 it('rejects invented movement, incompatible equipment and unsafe intensity',()=>{
   const p=rulesDraft(context,catalog)!;expect(p).not.toBeNull();
   const unknown=structuredClone(p);unknown.days.find(d=>!d.isRest)!.exercises[0].slug='invented';expect(()=>validatePlanningDraft(unknown,context,catalog)).toThrow();
   const hard=structuredClone(p);hard.days.find(d=>!d.isRest)!.exercises[0].rpe=9;expect(()=>validatePlanningDraft(hard,context,catalog)).toThrow();
   expect(()=>validatePlanningDraft(p,{...context,minutes:5},catalog)).toThrow();
 });
 it('keeps goal and schedule bounded instead of promising automatic progression',()=>{
   const p=rulesDraft(context,catalog)!;expect(p.goalType).toBe('health');expect(p.days.filter(d=>!d.isRest)).toHaveLength(3);
   expect(()=>validatePlanningDraft({...p,goalType:'build_muscle'},context,catalog)).toThrow();
   expect(requestNeedsReview('درد زانو دارم')).toBe(true);expect(requestNeedsReview('روزهای آزاد من عوض شده')).toBe(false);
 });
});
