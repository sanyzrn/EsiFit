import { describe, expect, it } from "vitest";
import {
  adjustWorkoutRest, pauseWorkoutRest, restClockLabel,
  restRemainingSeconds, resumeWorkoutRest, startWorkoutRest,
} from "@/lib/workout/rest-clock";

describe("guided workout rest clock", () => {
  const now = 1_800_000;
  it("counts against real elapsed time, including an inactive browser tab", () => {
    const r = startWorkoutRest("bench", 90, now);
    expect(restRemainingSeconds(r, now + 29_000)).toBe(61);
    expect(restRemainingSeconds(r, now + 100_000)).toBe(0);
  });
  it("pauses in place and resumes from exact remaining time", () => {
    const r = startWorkoutRest("bench", 90, now);
    const held = pauseWorkoutRest(r, now + 20_000);
    expect(restRemainingSeconds(held, now + 500_000)).toBe(70);
    expect(restRemainingSeconds(resumeWorkoutRest(held, now + 600_000), now + 615_000)).toBe(55);
  });
  it("supports 15-second increments while running and paused", () => {
    const r = startWorkoutRest("bench", 60, now);
    expect(restRemainingSeconds(adjustWorkoutRest(r, -15, now + 10_000), now + 10_000)).toBe(35);
    const p = pauseWorkoutRest(r, now + 10_000);
    expect(restRemainingSeconds(adjustWorkoutRest(p, 15, now + 900_000), now + 900_000)).toBe(65);
  });
  it("never produces a negative countdown and uses a stable mm:ss label", () => {
    const r = startWorkoutRest("bench", 10, now);
    expect(restRemainingSeconds(adjustWorkoutRest(r, -15, now), now)).toBe(0);
    expect(restClockLabel(125)).toBe("2:05");
  });
});

describe("active-set clock persistence", () => {
  it("uses real elapsed time and excludes an explicit pause, including after reload", async () => {
    const { startSetClock, pauseSetClock, resumeSetClock, setElapsedSeconds, restoreSetClock } = await import("@/lib/workout/rest-clock");
    const started = startSetClock(100000);
    expect(setElapsedSeconds(started, 130000)).toBe(30);
    const held = pauseSetClock(started, 130500);
    const restored = restoreSetClock(JSON.stringify(held), 200000);
    expect(setElapsedSeconds(restored, 999000)).toBe(30);
    expect(setElapsedSeconds(resumeSetClock(restored, 200000), 215000)).toBe(45);
  });
  it("recovers safely from corrupted, future and invalid saved clocks", async () => {
    const { restoreSetClock, startSetClock } = await import("@/lib/workout/rest-clock");
    const now = 500000;
    for (const raw of ["broken", "null", '{"accumulatedMs":-3,"startedAt":0}', '{"accumulatedMs":0,"startedAt":600000}']) {
      expect(restoreSetClock(raw, now)).toEqual(startSetClock(now));
    }
  });
});
