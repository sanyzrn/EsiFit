/**
 * Anatomy slug ↔ EsiFit muscle-group mapping + Persian labels.
 *
 * react-muscle-highlighter slugs (23) are coarser than EsiFit's 20 muscle
 * groups: deltoids/trapezius/quadriceps/hamstring/gluteal collapse our
 * front/side/rear variants, and `upper-back` stands in for `lats`.
 */

export type BodySlug =
  | "abs" | "adductors" | "ankles" | "biceps" | "calves" | "chest" | "deltoids"
  | "feet" | "forearm" | "gluteal" | "hamstring" | "hands" | "hair" | "head"
  | "knees" | "lower-back" | "neck" | "obliques" | "quadriceps" | "tibialis"
  | "trapezius" | "triceps" | "upper-back";

/** Slugs that carry training meaning (everything else is neutral body). */
export const TRAINED_SLUGS: BodySlug[] = [
  "abs", "biceps", "calves", "chest", "deltoids", "forearm", "gluteal",
  "hamstring", "obliques", "quadriceps", "trapezius", "triceps", "upper-back",
  "lower-back", "adductors",
];

export const BODY_SLUG_FA: Record<BodySlug, string> = {
  abs: "شکم",
  adductors: "داخل ران",
  ankles: "مچ پا",
  biceps: "جلو بازو",
  calves: "ساق پا",
  chest: "سینه",
  deltoids: "سرشانه",
  feet: "کف پا",
  forearm: "ساعد",
  gluteal: "باسن",
  hamstring: "همسترینگ",
  hands: "دست",
  hair: "مو",
  head: "سر",
  knees: "زانو",
  "lower-back": "کمر پایین",
  neck: "گردن",
  obliques: "پهلو",
  quadriceps: "چهارسر ران",
  tibialis: "درشت‌نی",
  trapezius: "کول",
  triceps: "پشت بازو",
  "upper-back": "زیربغل و پشت",
};

/** EsiFit MuscleGroup slug → body slug (many-to-one). */
export const MUSCLE_GROUP_TO_BODY: Record<string, BodySlug> = {
  chest: "chest",
  chest_upper: "chest",
  traps: "trapezius",
  lats: "upper-back",
  upper_back: "upper-back",
  lower_back: "lower-back",
  front_delts: "deltoids",
  side_delts: "deltoids",
  rear_delts: "deltoids",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearm",
  abs: "abs",
  obliques: "obliques",
  quads: "quadriceps",
  hamstrings: "hamstring",
  glutes: "gluteal",
  calves: "calves",
  adductors: "adductors",
  heart_lungs: "abs", // systemic — surfaced via text, not anatomy
};

/** Which side of the body shows each group (front/back availability). */
export const FRONT_SLUGS: Set<BodySlug> = new Set([
  "abs", "adductors", "biceps", "calves", "chest", "deltoids", "forearm",
  "hands", "knees", "obliques", "quadriceps", "tibialis", "ankles", "feet",
]);
export const BACK_SLUGS: Set<BodySlug> = new Set([
  "biceps", "calves", "deltoids", "forearm", "gluteal", "hamstring",
  "lower-back", "trapezius", "triceps", "upper-back", "obliques", "adductors",
]);

export function slugVisibleOn(slug: BodySlug, side: "front" | "back"): boolean {
  return side === "front" ? FRONT_SLUGS.has(slug) : BACK_SLUGS.has(slug);
}

/** Available in the vendored geometry (all four models). */
export function slugHasGeometry(slug: BodySlug, gender: "male" | "female", side: "front" | "back"): boolean {
  // Female back model lacks `ankles`.
  if (gender === "female" && side === "back" && slug === "ankles") return false;
  return true;
}
