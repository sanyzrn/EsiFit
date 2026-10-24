import { toLatinDigits } from "@/lib/formatting/numbers";
import type { CalculatorField } from "@/features/calculators/registry";

/** Input validation for the eight public calculators (text inputs do not honor HTML min/max). */
export function isApplicableCalculatorField(field: CalculatorField, values: Record<string, string>): boolean {
  return field.key !== "hipCm" || values.sex === "female";
}

export function parseCalculatorNumber(input: string): number | null {
  let value = toLatinDigits(input).trim().replace(/٫/g, ".").replace(/٬/g, "");
  // Accept an unambiguous grouped number (1,000) or decimal comma (80,5).
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value)) value = value.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(value)) value = value.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateCalculatorInputs(
  fields: CalculatorField[],
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!isApplicableCalculatorField(field, values)) continue;
    const raw = values[field.key]?.trim() ?? "";
    if (!raw) {
      errors[field.key] = "این مقدار را وارد کنید.";
      continue;
    }
    if (field.type === "select") {
      if (!field.options?.some((option) => option.value === raw)) {
        errors[field.key] = "گزینه معتبر انتخاب کنید.";
      }
      continue;
    }
    const n = parseCalculatorNumber(raw);
    if (n === null) {
      errors[field.key] = "عدد معتبر وارد کنید.";
      continue;
    }
    const currentJalaliYear = new Date().getUTCFullYear() - 621;
    const max = field.key === "birthYear"
      ? Math.min(field.max ?? Infinity, currentJalaliYear - 18)
      : field.max;
    if ((field.min !== undefined && n < field.min) || (max !== undefined && n > max)) {
      errors[field.key] = `عدد باید بین ${field.min ?? 0} و ${max ?? "∞"} باشد.`;
    } else if (["birthYear", "reps", "trainingMinutes"].includes(field.key) && !Number.isInteger(n)) {
      errors[field.key] = "عدد صحیح وارد کنید.";
    }
  }
  // Cross-field checks prevent logarithm domain errors and implausible Navy results.
  if (fields.some((field) => field.key === "neckCm")) {
    const waist = parseCalculatorNumber(values.waistCm ?? "");
    const neck = parseCalculatorNumber(values.neckCm ?? "");
    const hip = parseCalculatorNumber(values.hipCm ?? "");
    if (!errors.waistCm && !errors.neckCm && waist !== null && neck !== null && waist <= neck) {
      errors.waistCm = "دور کمر باید از دور گردن بیشتر باشد.";
    }
    if (values.sex === "female" && !errors.hipCm && hip !== null && hip <= 0) {
      errors.hipCm = "برای زنان دور باسن لازم است.";
    }
  }
  return errors;
}
