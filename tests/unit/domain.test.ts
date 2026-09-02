import { describe, it, expect } from "vitest";
import { computeGoalProgress, goalDirection, type GoalLike } from "@/lib/domain/goals";
import { buildProgressInsights, detectStrengthPlateau, type StrengthSeries } from "@/lib/domain/plateau";
import { adaptiveCoach } from "@/lib/domain/adaptive-coach";
import { rankSwaps, PAIN_REGION_MUSCLES, type SwapCandidate } from "@/lib/domain/swap-engine";
import { buildWeeklyRecap, type RecapMetrics } from "@/lib/domain/weekly-recap";
import { computeEsiScore } from "@/lib/domain/esi-score";
import { getEntitlements } from "@/lib/entitlements/entitlements";

describe("goals engine", () => {
  const base: GoalLike = {
    type: "weight", startValue: 84, targetValue: 80, unit: "kg",
    startDate: "2026-08-01", targetDate: "2026-10-01", metaJson: "{}",
  };
  it("down goal computes percent from loss", () => {
    const p = computeGoalProgress(base, 82, "2026-08-15");
    expect(p.direction).toBe("down");
    expect(p.percent).toBe(50);
    expect(p.achieved).toBe(false);
  });
  it("achieves at target", () => {
    const p = computeGoalProgress(base, 80, "2026-09-01");
    expect(p.achieved).toBe(true);
    expect(p.percent).toBe(100);
    expect(p.etaDays).toBe(0);
  });
  it("projects ETA from linear pace", () => {
    const p = computeGoalProgress(base, 82, "2026-08-15");
    expect(p.etaDays).toBeGreaterThan(0);
    expect(p.etaDays).toBeLessThanOrEqual(31);
  });
  it("up goal direction for frequency", () => {
    const g: GoalLike = { ...base, type: "workout_frequency", startValue: 1, targetValue: 4 };
    const p = computeGoalProgress(g, 2.5, "2026-08-15");
    expect(p.direction).toBe("up");
    expect(p.percent).toBe(50);
  });
  it("goalDirection honors metaJson override", () => {
    expect(goalDirection({ ...base, metaJson: '{"direction":"up"}', targetValue: 90 })).toBe("up");
  });
});

describe("plateau detector", () => {
  const series = (bests: number[]): StrengthSeries => ({
    exerciseSlug: "bench", exerciseName: "پرس سینه", dates: bests.map((_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`), bestKg: bests,
  });
  it("flat recent block triggers plateau", () => {
    expect(detectStrengthPlateau(series([70, 72, 72.1, 72, 72.2]))).toBe(true);
  });
  it("rising series does not trigger", () => {
    expect(detectStrengthPlateau(series([70, 72, 74, 76, 78]))).toBe(false);
  });
  it("short series never triggers (noise guard)", () => {
    expect(detectStrengthPlateau(series([70, 70]))).toBe(false);
  });

  const insights = buildProgressInsights({
    series: [series([70, 72, 72.1, 72, 72.2])],
    weeklyTonnage: [12000, 12200, 12100, 11900],
    adherence: { weekStarts: [], sessions: [3, 3], plannedPerWeek: 3 },
    daysSinceLastSession: 2,
    prsLast30Days: 1,
    weeklySessionsTarget: 3,
  });
  it("produces plateau warning + recent PR win", () => {
    const kinds = insights.map((i) => i.kind);
    expect(kinds).toContain("strength_plateau");
    expect(kinds).toContain("pr_streak");
    const plateau = insights.find((i) => i.kind === "strength_plateau")!;
    expect(plateau.severity).toBe("warning");
    expect(plateau.messageFa.length).toBeGreaterThan(10);
  });
  it("adherence drop fires below target-1", () => {
    const out = buildProgressInsights({
      series: [], weeklyTonnage: [5000, 5000, 5000, 5000],
      adherence: { weekStarts: [], sessions: [1, 1], plannedPerWeek: 4 },
      daysSinceLastSession: 1, prsLast30Days: 0, weeklySessionsTarget: 4,
    });
    expect(out.map((i) => i.kind)).toContain("adherence_drop");
  });
});

describe("adaptive coach", () => {
  const ready = { score: 88, state: "ready" as const };
  it("recommends push for ready + adherent", () => {
    const g = adaptiveCoach({
      readiness: ready, lastSessionRpe: 7, daysSinceLastSession: 1,
      sessionsLast14d: 6, weeklyTarget: 3, plateauDetected: false,
    });
    expect(g.tone).toBe("push");
    expect(g.volumeModifierPercent).toBeGreaterThan(0);
    expect(g.avoidMaxAttempts).toBe(false);
  });
  it("reduces volume when readiness is low", () => {
    const g = adaptiveCoach({
      readiness: { score: 30, state: "recover" }, lastSessionRpe: 7, daysSinceLastSession: 1,
      sessionsLast14d: 6, weeklyTarget: 3, plateauDetected: false,
    });
    expect(g.tone).toBe("recover");
    expect(g.volumeModifierPercent).toBeLessThanOrEqual(-20);
    expect(g.avoidMaxAttempts).toBe(true);
  });
  it("comeback rules win after long gap", () => {
    const g = adaptiveCoach({
      readiness: ready, lastSessionRpe: 7, daysSinceLastSession: 9,
      sessionsLast14d: 1, weeklyTarget: 3, plateauDetected: false,
    });
    expect(g.tone).toBe("return");
    expect(g.volumeModifierPercent).toBe(-20);
  });
  it("adjusts stimulus on plateau with good readiness", () => {
    const g = adaptiveCoach({
      readiness: ready, lastSessionRpe: 7, daysSinceLastSession: 1,
      sessionsLast14d: 6, weeklyTarget: 3, plateauDetected: true,
    });
    expect(g.tone).toBe("adjust");
  });
  it("high last RPE → maintain, not push", () => {
    const g = adaptiveCoach({
      readiness: ready, lastSessionRpe: 9.2, daysSinceLastSession: 1,
      sessionsLast14d: 6, weeklyTarget: 3, plateauDetected: false,
    });
    expect(g.tone).toBe("maintain");
    expect(g.avoidMaxAttempts).toBe(true);
  });
});

describe("swap engine", () => {
  const source = {
    slug: "barbell-bench-press", movementPattern: "horizontal_push", difficulty: "intermediate",
    isUnilateral: false, primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "front_delts"],
  };
  const cand = (o: Partial<SwapCandidate>): SwapCandidate => ({
    slug: "x", nameFa: "حرکت", equipment: "barbell", movementPattern: "horizontal_push",
    difficulty: "intermediate", isCompound: true, isUnilateral: false,
    primaryMuscles: ["chest"], secondaryMuscles: ["triceps"], ...o,
  });
  it("ranks same-muscle same-pattern highest", () => {
    const ranked = rankSwaps(source, [
      cand({ slug: "dumbbell-press", nameFa: "پرس دمبل" }),
      cand({ slug: "leg-press", nameFa: "پرس پا", movementPattern: "squat", primaryMuscles: ["quads"], secondaryMuscles: [] }),
    ], { availableEquipment: null, painRegions: [], excludeSlugs: ["barbell-bench-press"] });
    expect(ranked[0].candidate.slug).toBe("dumbbell-press");
    expect(ranked[0].reasonsFa).toContain("همان عضلات اصلی");
  });
  it("hard-filters candidates whose primary muscles hit pain regions", () => {
    const ranked = rankSwaps(
      { ...source, primaryMuscles: ["chest"], secondaryMuscles: [] },
      [
        cand({ slug: "shoulder-press", primaryMuscles: ["front_delts"] }),
        cand({ slug: "dumbbell-press", primaryMuscles: ["chest"] }),
      ],
      { availableEquipment: null, painRegions: ["shoulder"], excludeSlugs: [] },
    );
    expect(ranked.map((r) => r.candidate.slug)).toEqual(["dumbbell-press"]);
    expect(PAIN_REGION_MUSCLES.shoulder).toContain("front_delts");
  });
  it("equipment gate filters out missing equipment", () => {
    const ranked = rankSwaps(source, [
      cand({ slug: "machine-press", equipment: "machine" }),
      cand({ slug: "db-press", equipment: "dumbbell" }),
    ], { availableEquipment: new Set(["dumbbell"]), painRegions: [], excludeSlugs: [] });
    expect(ranked.map((r) => r.candidate.slug)).toEqual(["db-press"]);
  });
  it("excludes the source exercise", () => {
    const ranked = rankSwaps(source, [cand({ slug: "barbell-bench-press" })], { availableEquipment: null, painRegions: [], excludeSlugs: ["barbell-bench-press"] });
    expect(ranked).toHaveLength(0);
  });
});

describe("weekly recap", () => {
  const metrics: RecapMetrics = {
    weekStart: "2026-08-22", sessions: 3, plannedSessions: 4, tonnageKg: 12400,
    prevTonnageKg: 11000, prs: [{ exerciseName: "پرس سینه", valueKg: 72 }],
    avgReadiness: 78, nutritionDaysLogged: 5, streakDays: 4,
    weightDeltaKg: -0.4, topExerciseName: "اسکوات",
  };
  it("composes Persian narrative from real metrics", () => {
    const r = buildWeeklyRecap(metrics);
    expect(r.contentFa).toContain("۳");
    expect(r.contentFa).toContain("پرس سینه");
    expect(r.highlights.length).toBeGreaterThan(0);
    expect(r.metrics).toBe(metrics);
  });
  it("zero sessions → attention guidance", () => {
    const r = buildWeeklyRecap({ ...metrics, sessions: 0 });
    expect(r.attention.length).toBeGreaterThan(0);
  });
});

describe("esi-score", () => {
  it("computes explainable score within bounds", () => {
    const r = computeEsiScore({
      sessionsLast28d: 12, weeklyTarget: 3, streakDays: 5, prsLast30d: 2,
      strengthTrendPct: 6, volumeTrendPct: 8, avgReadiness14d: 78, nutritionDaysLogged28d: 18,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.factors.reduce((s, f) => s + f.weight, 0)).toBeCloseTo(1, 5);
    expect(r.factors.map((f) => f.labelFa)).toEqual(["پیوستگی", "قدرت", "حجم", "ریکاوری", "تغذیه"]);
    expect(["starting", "building", "strong", "elite"]).toContain(r.band);
  });
  it("zero activity → starting band", () => {
    const r = computeEsiScore({
      sessionsLast28d: 0, weeklyTarget: 3, streakDays: 0, prsLast30d: 0,
      strengthTrendPct: null, volumeTrendPct: null, avgReadiness14d: null, nutritionDaysLogged28d: 0,
    });
    expect(r.band).toBe("starting");
  });
});

describe("entitlements", () => {
  it("tiers are ordered for AI quota and analytics", () => {
    const free = getEntitlements("free");
    const vip = getEntitlements("vip");
    const vipPlus = getEntitlements("vip_plus");
    const coach = getEntitlements("coach");
    expect(free.aiMessagesPerDay).toBeLessThan(vip.aiMessagesPerDay);
    expect(vip.aiMessagesPerDay).toBeLessThan(vipPlus.aiMessagesPerDay);
    expect(vip.advancedAnalytics).toBe(true);
    expect(free.advancedAnalytics).toBe(false);
    expect(free.weeklyRecap).toBe(false);
    expect(coach.coachTools).toBe(true);
    expect(free.dataExport).toBe(false);
    expect(vip.dataExport).toBe(true);
  });
});
