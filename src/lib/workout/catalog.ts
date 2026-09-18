import "server-only";
import { db } from "@/lib/db";
import { parseAvailableEquipment } from "@/lib/workout/equipment";

/**
 * Exercise catalog helpers for equipment-aware programming.
 */

export type CatalogExercise = {
  id: string;
  slug: string;
  nameFa: string;
  equipment: string;
  movementPattern: string;
  difficulty: string;
  isCompound: boolean;
  primaryMuscles: string[];
};

export async function loadExerciseCatalog(): Promise<CatalogExercise[]> {
  const rows = await db.exercise.findMany({
    include: { muscles: { include: { muscleGroup: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    slug: e.slug,
    nameFa: e.nameFa,
    equipment: e.equipment,
    movementPattern: e.movementPattern,
    difficulty: e.difficulty,
    isCompound: e.isCompound,
    primaryMuscles: e.muscles.filter((m) => m.role === "primary").map((m) => m.muscleGroup.slug),
  }));
}

/**
 * Resolve a template slug to a concrete exercise the user can perform.
 * Returns null when the catalog has no usable option (caller may skip).
 */
export function resolveExerciseForEquipment(
  catalog: CatalogExercise[],
  slug: string,
  available: Set<string> | null,
): CatalogExercise | null {
  const source = catalog.find((e) => e.slug === slug) ?? null;
  if (!source) return null;
  if (!available || available.has(source.equipment)) return source;

  const samePattern = catalog.filter(
    (e) => e.slug !== slug && e.movementPattern === source.movementPattern && available.has(e.equipment),
  );
  const byPattern = samePattern.find((e) =>
    source.primaryMuscles.some((m) => e.primaryMuscles.includes(m)),
  );
  if (byPattern) return byPattern;
  if (samePattern[0]) return samePattern[0];

  const byMuscle = catalog.filter(
    (e) =>
      e.slug !== slug &&
      available.has(e.equipment) &&
      source.primaryMuscles.some((m) => e.primaryMuscles.includes(m)),
  );
  if (byMuscle[0]) return byMuscle[0];

  // Last resort: any allowed equipment exercise that is not a pure cardio-only
  // swap for a strength pattern when the source is not conditioning.
  if (source.movementPattern === "conditioning") {
    return catalog.find((e) => e.slug !== slug && available.has(e.equipment) && e.movementPattern === "conditioning") ?? null;
  }
  return null;
}

/** Load the user's equipment restriction from their profile. */
export async function getUserEquipmentSet(userId: string): Promise<Set<string> | null> {
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { availableEquipment: true },
  });
  return parseAvailableEquipment(profile?.availableEquipment);
}
