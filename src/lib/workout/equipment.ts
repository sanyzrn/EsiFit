/**
 * Profile equipment availability.
 * Storage: UserProfile.availableEquipment = JSON string array.
 * Empty / missing = unrestricted (full gym) so seed users keep working.
 */

export const EQUIPMENT_KEYS = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "band",
  "cardio",
] as const;

export type EquipmentKey = (typeof EQUIPMENT_KEYS)[number];

export const EQUIPMENT_LABEL_FA: Record<EquipmentKey, string> = {
  barbell: "هالتر",
  dumbbell: "دمبل",
  machine: "دستگاه",
  cable: "سیم‌کش",
  bodyweight: "وزن بدن",
  kettlebell: "کتل‌بل",
  band: "کش",
  cardio: "کاردیو",
};

const KNOWN = new Set<string>(EQUIPMENT_KEYS);

/** Parse stored JSON → Set, or null when unrestricted. */
export function parseAvailableEquipment(raw: string | null | undefined): Set<string> | null {
  if (raw == null || raw.trim() === "" || raw.trim() === "[]") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const list = parsed.filter((x): x is string => typeof x === "string" && KNOWN.has(x));
    // Unrestricted if user selected every known equipment type.
    if (list.length === 0 || list.length >= EQUIPMENT_KEYS.length) return null;
    return new Set(list);
  } catch {
    return null;
  }
}

/** Serialize a selection for storage; full gym → empty string. */
export function serializeAvailableEquipment(keys: string[]): string {
  const list = [...new Set(keys.filter((k) => KNOWN.has(k)))];
  if (list.length === 0 || list.length >= EQUIPMENT_KEYS.length) return "";
  return JSON.stringify(list);
}

export function equipmentSetFromList(keys: string[]): Set<string> | null {
  return parseAvailableEquipment(serializeAvailableEquipment(keys));
}
