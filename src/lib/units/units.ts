/**
 * Unit conversion — canonical storage is metric (kg/cm/ml/kcal).
 * Presentation may be metric or imperial; conversion happens ONLY here.
 */

export type UnitSystem = "metric" | "imperial";

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}
export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}
export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}
export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalIn = cmToIn(cm);
  const feet = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn - feet * 12);
  return inches === 12 ? { feet: feet + 1, inches: 0 } : { feet, inches };
}

/** Convert kg → display unit value. */
export function displayWeight(kg: number, system: UnitSystem): number {
  return system === "metric" ? kg : kgToLb(kg);
}

/** Convert display-unit weight input → canonical kg. */
export function canonicalWeight(value: number, system: UnitSystem): number {
  return system === "metric" ? value : lbToKg(value);
}

export function displayHeight(cm: number, system: UnitSystem): number {
  return system === "metric" ? cm : cmToIn(cm);
}

export function canonicalHeight(value: number, system: UnitSystem): number {
  return system === "metric" ? value : inToCm(value);
}

export const weightUnit = (system: UnitSystem) => (system === "metric" ? "کیلوگرم" : "پوند");
export const heightUnit = (system: UnitSystem) => (system === "metric" ? "سانتی‌متر" : "اینچ");
export const volumeUnit = (system: UnitSystem) => (system === "metric" ? "کیلوگرم" : "پوند");
export const distanceUnit = (system: UnitSystem) => (system === "metric" ? "کیلومتر" : "مایل");

/** Meters → km display with sensible rounding. */
export function displayDistanceKm(meters: number): number {
  return Math.round((meters / 1000) * 100) / 100;
}
