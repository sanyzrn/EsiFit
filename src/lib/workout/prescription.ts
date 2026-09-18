/**
 * Default training prescriptions for free-form / swapped exercises.
 * Plan-day prescriptions always win when a PlannedExercise row exists —
 * these are fallbacks so the live HUD never invents random programming.
 */

export type Prescription = {
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetRpe: number;
  restSeconds: number;
  note: string;
};

export function defaultPrescription(ex: {
  isCompound?: boolean;
  difficulty?: string;
  movementPattern?: string;
}): Prescription {
  const pattern = ex.movementPattern ?? "";
  if (pattern === "core" || pattern === "conditioning") {
    return { targetSets: 3, targetRepsMin: 12, targetRepsMax: 20, targetRpe: 7, restSeconds: 60, note: "" };
  }
  if (ex.isCompound) {
    return { targetSets: 4, targetRepsMin: 5, targetRepsMax: 8, targetRpe: 8, restSeconds: 150, note: "" };
  }
  return { targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetRpe: 7.5, restSeconds: 90, note: "" };
}
