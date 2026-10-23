/**
 * Reviewed, exact-ID links from EsiFit's original curated movements to
 * RepDB Free Tier illustrations (2026-10-23 snapshot).
 *
 * No openGym/Gym visual media are copied or referenced here.
 * RepDB Free Tier permits in-app use with visible attribution.
 * https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md
 * These are remote trial assets; self-host for production reliability.
 */
const EXACT_REPDB_IDS = new Set([
  "incline-bench-press", "push-up", "dips", "dumbbell-shoulder-press",
  "lateral-raise", "face-pull", "arnold-press", "deadlift",
  "romanian-deadlift", "pull-up", "lat-pulldown", "barbell-row",
  "seated-cable-row", "shrug", "hammer-curl", "wrist-curl",
  "goblet-squat", "leg-press", "hack-squat", "lunge",
  "bulgarian-split-squat", "leg-extension", "leg-curl", "hip-thrust",
  "plank", "hanging-leg-raise", "russian-twist", "cable-crunch",
  "side-plank", "cycling", "rowing-machine", "jump-rope",
  "kettlebell-swing", "upright-row", "front-squat", "glute-kickback",
  "band-pull-apart", "preacher-curl", "smith-machine-squat",
  "seated-calf-raise", "good-morning", "stair-climber", "sled-push",
  "chest-press-machine", "pec-deck", "back-extension",
]);

const STATIC_ONLY = new Set([
  "plank", "side-plank", "cycling", "jump-rope", "stair-climber", "sled-push",
]);

const CDN = "https://exercise-dataset.com/images/flat";

export type ExerciseVisualData = { start: string; finish: string | null };

export function exerciseVisualFor(slug: string): ExerciseVisualData | null {
  if (!EXACT_REPDB_IDS.has(slug)) return null;
  if (STATIC_ONLY.has(slug)) return { start: `${CDN}/${slug}-main.webp`, finish: null };
  return {
    start: `${CDN}/${slug}-start.webp`,
    finish: `${CDN}/${slug}-peak.webp`,
  };
}

export const VISUAL_COVERAGE = EXACT_REPDB_IDS.size;
