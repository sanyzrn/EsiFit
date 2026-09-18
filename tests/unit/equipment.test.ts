import { describe, it, expect } from "vitest";
import { parseAvailableEquipment, serializeAvailableEquipment, equipmentSetFromList } from "@/lib/workout/equipment";
import { resolveExerciseForEquipment, type CatalogExercise } from "@/lib/workout/catalog";

describe("equipment parse/serialize", () => {
  it("treats empty / missing / full list as unrestricted", () => {
    expect(parseAvailableEquipment("")).toBeNull();
    expect(parseAvailableEquipment("[]")).toBeNull();
    expect(parseAvailableEquipment(null)).toBeNull();
    expect(parseAvailableEquipment('["barbell","dumbbell","machine","cable","bodyweight","kettlebell","band","cardio"]')).toBeNull();
  });

  it("parses a restricted subset", () => {
    const set = parseAvailableEquipment('["dumbbell","bodyweight"]');
    expect(set).toEqual(new Set(["dumbbell", "bodyweight"]));
  });

  it("ignores unknown equipment keys", () => {
    const set = parseAvailableEquipment('["dumbbell","lightsaber"]');
    expect(set).toEqual(new Set(["dumbbell"]));
  });

  it("serialize collapses full gym to empty storage", () => {
    expect(serializeAvailableEquipment([])).toBe("");
    expect(serializeAvailableEquipment(["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "cardio"])).toBe("");
    expect(serializeAvailableEquipment(["dumbbell", "band"])).toBe('["dumbbell","band"]');
  });

  it("equipmentSetFromList round-trips", () => {
    expect(equipmentSetFromList([])).toBeNull();
    expect(equipmentSetFromList(["band"])).toEqual(new Set(["band"]));
  });
});

describe("resolveExerciseForEquipment", () => {
  const catalog: CatalogExercise[] = [
    { id: "1", slug: "barbell-bench-press", nameFa: "پرس سینه هالتر", equipment: "barbell", movementPattern: "horizontal_push", difficulty: "intermediate", isCompound: true, primaryMuscles: ["chest"] },
    { id: "2", slug: "push-up", nameFa: "شنا", equipment: "bodyweight", movementPattern: "horizontal_push", difficulty: "beginner", isCompound: true, primaryMuscles: ["chest"] },
    { id: "3", slug: "incline-dumbbell-press", nameFa: "پرس بالاسینه دمبل", equipment: "dumbbell", movementPattern: "horizontal_push", difficulty: "beginner", isCompound: true, primaryMuscles: ["chest_upper"] },
    { id: "4", slug: "barbell-squat", nameFa: "اسکات هالتر", equipment: "barbell", movementPattern: "squat", difficulty: "intermediate", isCompound: true, primaryMuscles: ["quads"] },
    { id: "5", slug: "band-pull-apart", nameFa: "پول‌آپارت کش", equipment: "band", movementPattern: "horizontal_pull", difficulty: "beginner", isCompound: false, primaryMuscles: ["rear_delts"] },
  ];

  it("keeps the original exercise when equipment allows it", () => {
    const r = resolveExerciseForEquipment(catalog, "barbell-bench-press", null);
    expect(r?.slug).toBe("barbell-bench-press");
  });

  it("substitutes same-pattern exercise when barbell is unavailable", () => {
    const r = resolveExerciseForEquipment(catalog, "barbell-bench-press", new Set(["bodyweight"]));
    expect(r?.slug).toBe("push-up");
  });

  it("returns null when no allowed substitute exists", () => {
    const r = resolveExerciseForEquipment(catalog, "barbell-squat", new Set(["band"]));
    expect(r).toBeNull();
  });

  it("returns null for unknown template slug", () => {
    expect(resolveExerciseForEquipment(catalog, "treadmill-run", null)).toBeNull();
  });
});
