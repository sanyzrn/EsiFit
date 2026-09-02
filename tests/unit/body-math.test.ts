import { describe, it, expect } from "vitest";
import {
  bmi, bmiCategory, oneRepMax, oneRepMaxTable, whtr, whtrCategory, idealWeightRange,
  dailyWaterMl, computeMacroTargets, computeReadiness, xpForLevel, levelFromXp,
} from "@/lib/domain/body-math";

describe("body-math: BMI", () => {
  it("computes standard values", () => {
    expect(bmi(70, 175)).toBeCloseTo(22.86, 1);
    expect(bmi(90, 175)).toBeGreaterThan(29);
  });
  it("classifies WHO bands", () => {
    expect(bmiCategory(17)).toBe("underweight");
    expect(bmiCategory(22)).toBe("normal");
    expect(bmiCategory(27)).toBe("overweight");
    expect(bmiCategory(35)).toBe("obese");
  });
});

describe("body-math: 1RM (Epley + Brzycki average)", () => {
  it("stays within [weight, weight+5%] for 1 rep (Epley/Brzycki average)", () => {
    const r = oneRepMax(100, 1);
    expect(r.recommended).toBeGreaterThanOrEqual(100);
    expect(r.recommended).toBeLessThanOrEqual(105);
  });
  it("returns zero for impossible inputs", () => {
    expect(oneRepMax(0, 5).recommended).toBe(0);
    expect(oneRepMax(50, 0).recommended).toBe(0);
  });
  it("monotonically increases with weight", () => {
    expect(oneRepMax(80, 5).recommended).toBeLessThan(oneRepMax(100, 5).recommended);
  });
  it("programming table spans 95%..65% with rounded weights", () => {
    const table = oneRepMaxTable(100);
    expect(table[0].pct).toBe(95);
    expect(table.at(-1)!.pct).toBe(65);
    expect(table.every((t) => t.weight <= 100)).toBe(true);
  });
});

describe("body-math: WHtR", () => {
  it("classifies Ashwell bands", () => {
    expect(whtr(80, 180)).toBeCloseTo(0.444, 2);
    expect(whtrCategory(whtr(80, 180))).toBe("healthy");
    expect(whtrCategory(whtr(110, 175))).toBe("high");
    expect(whtrCategory(whtr(60, 180))).toBe("slim");
  });
});

describe("body-math: ideal weight (Devine/Robinson)", () => {
  it("male vs female ranges differ", () => {
    const male = idealWeightRange(178, "male");
    const female = idealWeightRange(165, "female");
    expect(male.min).toBeGreaterThan(50);
    expect(female.max).toBeLessThan(male.min);
  });
});

describe("body-math: water", () => {
  it("adds training allowance and rounds to 100ml", () => {
    expect(dailyWaterMl(70, 0)).toBe(2300); // 70×33 = 2310 → rounded
    expect(dailyWaterMl(70, 60)).toBe(2700); // +420ml training
  });
});

describe("body-math: macro targets", () => {
  it("protein scales by goal, fat floor respected, carbs computed from remainder", () => {
    const t = computeMacroTargets({
      sex: "male", birthYear: 1374, heightCm: 178, weightKg: 80,
      activityLevel: "moderate", goal: "build_muscle",
    });
    expect(t.proteinG).toBe(160); // 80kg × 2.0 (build_muscle)
    expect((t.fatG * 9) / t.calories).toBeGreaterThanOrEqual(0.2); // ≥25% of energy from fat
    expect(t.carbsG).toBeGreaterThanOrEqual(50);
    expect(t.strategyLabel).toContain("مازاد");
  });
  it("cutting keeps protein high (2.2 g/kg)", () => {
    const t = computeMacroTargets({
      sex: "female", birthYear: 1370, heightCm: 165, weightKg: 70,
      activityLevel: "light", goal: "lose_weight",
    });
    expect(t.proteinG).toBe(154); // 70 × 2.2
  });
});

describe("body-math: readiness", () => {
  it("produces bounded score + state + factors", () => {
    const r = computeReadiness({
      sleepQualityScore: 80, sleepDurationMinutes: 450, trainingLoadLast3Days: 900,
      avgTrainingLoad14d: 800, adherenceLast7d: 0.9, daysSinceLastWorkout: 1,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(["ready", "moderate", "caution", "recover"]).toContain(r.state);
    expect(r.factors.length).toBeGreaterThan(0);
  });
  it("poor sleep and high load lower score", () => {
    const good = computeReadiness({ sleepQualityScore: 90, sleepDurationMinutes: 480, trainingLoadLast3Days: 600, avgTrainingLoad14d: 700, adherenceLast7d: 1, daysSinceLastWorkout: 1 });
    const bad = computeReadiness({ sleepQualityScore: 20, sleepDurationMinutes: 240, trainingLoadLast3Days: 2000, avgTrainingLoad14d: 900, adherenceLast7d: 0.2, daysSinceLastWorkout: 6 });
    expect(bad.score).toBeLessThan(good.score);
  });
});

describe("body-math: XP curve", () => {
  it("levels need increasing XP", () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(10)).toBeGreaterThan(xpForLevel(5));
  });
  it("levelFromXp inverts xpForLevel", () => {
    const { level, progress } = levelFromXp(xpForLevel(3) + 1);
    expect(level).toBeGreaterThanOrEqual(3);
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(1);
  });
});
