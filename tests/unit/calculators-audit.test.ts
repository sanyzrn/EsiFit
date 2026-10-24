import { describe, expect, it } from "vitest";
import { CALCULATOR_CONFIGS } from "@/features/calculators/registry";
import { computeCalculator } from "@/features/calculators/compute";
import { isApplicableCalculatorField, parseCalculatorNumber, validateCalculatorInputs } from "@/features/calculators/validation";
import {
  bmi, bmiCategory, whtr, whtrCategory, oneRepMax, computeMacroTargets, idealWeightRange,
} from "@/lib/domain/body-math";

const common = { sex: "male", birthYear: "۱۳۷۴", weightKg: "۸۲", heightCm: "۱۷۸", activityLevel: "moderate", goal: "build_muscle" };
const fixtures: Record<string, Record<string, string>> = {
  bmi: common,
  tdee: common,
  macros: common,
  "one-rep-max": { weightKg: "۶۰", reps: "۵" },
  "ideal-weight": { sex: "male", heightCm: "۱۷۸" },
  whtr: { waistCm: "۸۸", heightCm: "۱۷۸" },
  water: { weightKg: "۸۲", trainingMinutes: "۶۰" },
  "body-fat-navy": { sex: "female", heightCm: "۱۶۵", neckCm: "۳۲", waistCm: "۷۵", hipCm: "۹۵" },
};

describe("all eight public calculators", () => {
  it("keeps all calculator slugs covered by reference examples", () => {
    expect(CALCULATOR_CONFIGS.map((x) => x.slug).sort()).toEqual(Object.keys(fixtures).sort());
  });

  it.each(CALCULATOR_CONFIGS.map((c) => c.slug))("%s accepts realistic localized values and yields a valid result", (slug) => {
    const fields = CALCULATOR_CONFIGS.find((c) => c.slug === slug)!.inputs;
    const values = fixtures[slug];
    expect(validateCalculatorInputs(fields, values)).toEqual({});
    const result = computeCalculator(slug, values);
    expect(result).not.toBeNull();
    expect(result?.headlineValue).toBeTruthy();
    expect(result?.headlineValue).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("parses Persian decimals, decimal commas, and thousand groups consistently", () => {
    expect(parseCalculatorNumber("۸۰٫۵")).toBe(80.5);
    expect(parseCalculatorNumber("80,5")).toBe(80.5);
    expect(parseCalculatorNumber("1,234")).toBe(1234);
    expect(parseCalculatorNumber("10foo")).toBeNull();
    expect(computeCalculator("bmi", { weightKg: "80,5", heightCm: "175" })?.headlineValue)
      .toBe(computeCalculator("bmi", { weightKg: "80.5", heightCm: "175" })?.headlineValue);
  });

  it("rejects out-of-range, negative, malformed and fractional integer inputs", () => {
    const config = CALCULATOR_CONFIGS.find((c) => c.slug === "one-rep-max")!;
    expect(validateCalculatorInputs(config.inputs, { weightKg: "۱۰۰۰۰", reps: "۵" }).weightKg).toBeTruthy();
    expect(validateCalculatorInputs(config.inputs, { weightKg: "-۳", reps: "۵" }).weightKg).toBeTruthy();
    expect(validateCalculatorInputs(config.inputs, { weightKg: "۸۰abc", reps: "۵" }).weightKg).toBeTruthy();
    expect(validateCalculatorInputs(config.inputs, { weightKg: "۸۰", reps: "۲٫۵" }).reps).toBeTruthy();
  });

  it("requires an adult birth year (not a future age silently clamped)", () => {
    const fields = CALCULATOR_CONFIGS.find((c) => c.slug === "tdee")!.inputs;
    expect(validateCalculatorInputs(fields, { ...common, birthYear: "۱۴۲۰" }).birthYear).toBeTruthy();
  });

  it("requires female hip and waist independently, but hides the hip field for men", () => {
    const fields = CALCULATOR_CONFIGS.find((c) => c.slug === "body-fat-navy")!.inputs;
    const values = fixtures["body-fat-navy"];
    expect(validateCalculatorInputs(fields, { ...values, hipCm: "" }).hipCm).toBeTruthy();
    expect(validateCalculatorInputs(fields, { ...values, waistCm: "۳۰" }).waistCm).toBeTruthy();
    expect(isApplicableCalculatorField(fields.find((f) => f.key === "hipCm")!, { sex: "male" })).toBe(false);
  });

  it("preserves multi-number headline ranges instead of coercing to a single number", () => {
    const result = computeCalculator("ideal-weight", fixtures["ideal-weight"]);
    expect(result?.headlineValue).toContain("تا");
    expect(result?.headlineValue).toContain("کیلوگرم");
  });

  it("shows a measured one-rep max without extrapolating", () => {
    expect(oneRepMax(100, 1).recommended).toBe(100);
    expect(oneRepMax(100, 1).epley).toBe(100);
    expect(oneRepMax(100, 36).brzycki).toBe(0);
  });

  it("does not round waist-to-height boundaries into the wrong category", () => {
    const value = whtr(89.9, 180);
    expect(value).toBe(0.499);
    expect(whtrCategory(89.9 / 180)).toBe("healthy");
    expect(computeCalculator("whtr", { waistCm: "89.9", heightCm: "180" })?.headlineValue).toBeTruthy();
  });

  it("keeps macro energy totals consistent for an extreme high-weight input", () => {
    const macros = computeMacroTargets({
      sex: "female", birthYear: 1370, heightCm: 150, weightKg: 300,
      activityLevel: "sedentary", goal: "lose_weight",
    });
    const sum = macros.proteinG * 4 + macros.fatG * 9 + macros.carbsG * 4;
    expect(Math.abs(sum - macros.calories)).toBeLessThanOrEqual(3);
    expect(macros.carbsG).toBeGreaterThanOrEqual(50);
  });

  it("does not inflate ideal weight beyond the Devine/Robinson estimates", () => {
    const r = idealWeightRange(178, "male");
    expect(r.max - r.min).toBeLessThan(10);
    expect(bmiCategory(bmi(70, 175))).toBe("normal");
  });
});
