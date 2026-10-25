import { EXERCISES } from "@/features/workouts/data/exercise-dataset";
import { describe, expect, it } from "vitest";
import { exerciseVisualFor, VISUAL_COVERAGE } from "@/features/workouts/data/exercise-media";

describe("legally licensed training imagery", () => {
  it("covers only manually reviewed exact EsiFit exercise IDs", () => {
    expect(VISUAL_COVERAGE).toBe(EXERCISES.length);
    for(const e of EXERCISES) expect(exerciseVisualFor(e.slug), e.slug).not.toBeNull();
    expect(exerciseVisualFor("bench-press")).toBeNull();
    expect(exerciseVisualFor("barbell-bench-press")?.start).toContain("/bench-press-start.webp");
  });

  it("has a correct pair of stills for a supported rep-based movement", () => {
    const media = exerciseVisualFor("deadlift");
    expect(media?.start).toMatch(/repdb|exercise-dataset\.com/);
    expect(media?.start).toContain("/deadlift-start.webp");
    expect(media?.finish).toContain("/deadlift-peak.webp");
  });

  it("supports single-frame cardio and holds without fake animation", () => {
    const media = exerciseVisualFor("plank");
    expect(media?.start).toContain("/plank-main.webp");
    expect(media?.finish).toBeNull();
  });

  it("never copies or requests openGym or Gym visual restricted media", () => {
    for (const slug of ["deadlift", "plank", "lat-pulldown", "goblet-squat"]) {
      const media = exerciseVisualFor(slug);
      const urls = [media?.start, media?.finish].filter(Boolean).join(" ");
      expect(urls).not.toMatch(/gymvisual|DuarteSantos8|opengym/ig);
      expect(urls).toMatch(/^https:\/\/exercise-dataset\.com\//);
    }
  });
});
