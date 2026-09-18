/**
 * Smart Exercise Swap engine (roadmap: EXERCISE_SWAP + PainReport).
 * Pure scoring: rank candidate exercises for a source exercise given
 * equipment availability and active pain reports. Data access happens at API.
 */

export type SwapCandidate = {
  slug: string;
  nameFa: string;
  equipment: string;
  movementPattern: string;
  difficulty: string;
  isCompound: boolean;
  isUnilateral: boolean;
  primaryMuscles: string[]; // MuscleGroup slugs
  secondaryMuscles: string[];
};

export type SwapSource = {
  slug: string;
  movementPattern: string;
  difficulty: string;
  isUnilateral: boolean;
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

export type SwapContext = {
  /** Equipment the user can use right now; null = no restriction. */
  availableEquipment: Set<string> | null;
  /** Active pain regions from PainReport.bodyRegion values. */
  painRegions: string[];
  /** Exclude the source exercise itself. */
  excludeSlugs: string[];
};

export type RankedSwap = {
  candidate: SwapCandidate;
  score: number; // 0..1
  reasonsFa: string[];
  /** True when the candidate avoids all pain-mapped muscles. */
  painSafe: boolean;
};

/** bodyRegion → muscle slugs that should be avoided as PRIMARY movers. */
export const PAIN_REGION_MUSCLES: Record<string, string[]> = {
  lower_back: ["lower_back"],
  shoulder: ["front_delts", "side_delts", "rear_delts", "traps"],
  knee: ["quads"],
  elbow: ["biceps", "triceps", "forearms"],
  wrist: ["forearms", "biceps", "triceps"],
  hip: ["glutes", "adductors", "hamstrings"],
  ankle: ["calves"],
  neck: ["traps", "upper_back"],
  groin: ["adductors"],
  ribs: ["obliques"],
};

const DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"];

/** Rank swap candidates. Hard-filters pain-unsafe primaries & missing equipment; scores the rest. */
export function rankSwaps(
  source: SwapSource,
  candidates: SwapCandidate[],
  context: SwapContext,
): RankedSwap[] {
  const avoidMuscles = new Set(
    context.painRegions.flatMap((r) => PAIN_REGION_MUSCLES[r] ?? []),
  );
  const srcPrimary = new Set(source.primaryMuscles);
  const srcAll = new Set([...source.primaryMuscles, ...source.secondaryMuscles]);
  const srcDiffIdx = DIFFICULTY_ORDER.indexOf(source.difficulty);

  const ranked: RankedSwap[] = [];
  for (const c of candidates) {
    if (context.excludeSlugs.includes(c.slug)) continue;

    // Equipment gate (hard).
    if (context.availableEquipment && !context.availableEquipment.has(c.equipment)) continue;

    // Pain gate (hard): candidate primary muscles must avoid pain-mapped set.
    const primaryHitsPain = c.primaryMuscles.some((m) => avoidMuscles.has(m));
    if (primaryHitsPain) continue;
    const secondaryHitsPain = c.secondaryMuscles.some((m) => avoidMuscles.has(m));

    // Difficulty: prefer same or one step easier; allow one harder.
    const cDiffIdx = DIFFICULTY_ORDER.indexOf(c.difficulty);
    if (srcDiffIdx >= 0 && cDiffIdx > srcDiffIdx + 1) continue;

    // Primary-muscle overlap — the core of a good swap.
    const overlap = c.primaryMuscles.filter((m) => srcPrimary.has(m)).length;
    const overlapScore = srcPrimary.size === 0 ? 0.4 : overlap / srcPrimary.size;

    // Pattern affinity.
    const patternScore = c.movementPattern === source.movementPattern ? 1 : 0.55;

    // Soft contributions.
    const unilateralScore = c.isUnilateral === source.isUnilateral ? 1 : 0.7;
    const difficultyScore = cDiffIdx <= srcDiffIdx ? 1 : 0.8;
    const painBonus = secondaryHitsPain ? 0.85 : 1;
    const fullBodyCoverage = c.primaryMuscles.filter((m) => srcAll.has(m)).length / Math.max(1, srcAll.size);

    const score =
      overlapScore * 0.42 +
      patternScore * 0.22 +
      fullBodyCoverage * 0.12 +
      unilateralScore * 0.08 +
      difficultyScore * 0.08 +
      painBonus * 0.08;

    const reasonsFa: string[] = [];
    if (overlap > 0) reasonsFa.push("همان عضلات اصلی");
    if (patternScore === 1) reasonsFa.push("الگوی حرکتی مشابه");
    if (secondaryHitsPain) reasonsFa.push("فشار کمتر — عضلات ثانویه حساس");
    else if (context.painRegions.length > 0) reasonsFa.push("بدون فشار به ناحیه دردناک");
    if (cDiffIdx <= srcDiffIdx) reasonsFa.push("هم‌سطح یا ساده‌تر");
    if (context.availableEquipment) reasonsFa.push("با وسایل موجود شما");

    ranked.push({
      candidate: c,
      score: Math.min(1, score),
      reasonsFa: reasonsFa.slice(0, 3),
      // Primary muscles already avoid pain-mapped set; secondary hits are not fully pain-safe.
      painSafe: !primaryHitsPain && !secondaryHitsPain,
    });
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, 5);
}
