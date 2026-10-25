import { describe, expect, it } from "vitest";
import { canPromoteInstall, INSTALL_MIN_ACTIVE_SECONDS } from "@/lib/client/install-policy";
import { PLAN_PRESETS } from "@/lib/workout/plan-presets";
import { coachProgramInput } from "@/lib/coach/program-contract";
import { EXERCISES } from "@/features/workouts/data/exercise-dataset";
import { FOODS } from "@/features/nutrition/data/food-database";
import { USDA_FOODS, USDA_FOOD_SOURCES } from "@/features/nutrition/data/usda-foods";
import { normalizePersianSearch } from "@/lib/formatting/search";
it("waits for active interest and respects dismissal",()=>{
  const p={seconds:INSTALL_MIN_ACTIVE_SECONDS,paths:["/","/store"],actions:0};
  expect(canPromoteInstall({...p,seconds:0},100,0)).toBe(false);
  expect(canPromoteInstall({...p,paths:["/"]},100,0)).toBe(false);
  expect(canPromoteInstall(p,100,0)).toBe(true);
  expect(canPromoteInstall(p,100,101)).toBe(false);
  expect(canPromoteInstall({...p,paths:["/"],actions:3},100,0)).toBe(true);
});
describe("reviewed catalog",()=>{
  it("has complete unique movements and usable seven-day templates",()=>{
    const slugs=new Set(EXERCISES.map(e=>e.slug));expect(slugs.size).toBe(EXERCISES.length);
    expect(Object.keys(PLAN_PRESETS)).toHaveLength(8);
    for(const p of Object.values(PLAN_PRESETS)){
      for(const d of p.days)for(const e of d.exercises)expect(slugs.has(e.slug),e.slug).toBe(true);
      expect(coachProgramInput.safeParse({athleteId:"fixture",sourcePlanId:null,name:p.name,description:p.description,goalType:"health",weeks:4,days:p.days}).success,p.name).toBe(true);
    }
    expect(PLAN_PRESETS.ppl.days.filter(d=>!d.isRest)).toHaveLength(3);
  });
  it("keeps declared food servings, states and USDA provenance",()=>{
    expect(new Set(FOODS.map(f=>f.slug)).size).toBe(FOODS.length);
    expect(USDA_FOODS).toHaveLength(46);
    for(const f of USDA_FOODS){expect(USDA_FOOD_SOURCES[f.slug].fdcId).toBeGreaterThan(0);expect(f.servingAmount).toBeGreaterThan(0);expect(f.calories).toBeGreaterThanOrEqual(0);expect(f.proteinG+f.carbsG+f.fatG).toBeLessThanOrEqual(f.servingAmount+1);}
    expect(USDA_FOODS.find(f=>f.slug==="lentils-cooked")).toMatchObject({calories:116,proteinG:9.02,servingAmount:100});
    expect(USDA_FOODS.find(f=>f.slug==="olive-oil")).toMatchObject({calories:88.4,servingAmount:10});
  });
  it("normalizes Arabic keyboard variants and half spaces",()=>expect(normalizePersianSearch(" كيوي‌ سبز ")).toBe("کیوی سبز"));
});
