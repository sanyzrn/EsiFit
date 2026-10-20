import { describe, it, expect } from "vitest";
import { suggestNextLoad, incrementFor, platesPerSide, warmupRamp } from "@/lib/workout/progression";
import { normalizeFa, matchScore, rankBySearch } from "@/lib/search/normalize";
import { computeBalance, recoveryState, recencyIntensity } from "@/lib/domain/balance";

const sets = (w: number, reps: number[], rpe: number | null = null) => reps.map((r) => ({ weightKg: w, reps: r, rpe }));

describe("double progression", () => {
  it("adds the smallest increment once every set reaches the top of the range", () => {
    const s = suggestNextLoad({ lastSets: sets(80, [8, 8, 8]), repsMin: 6, repsMax: 8, equipment: "barbell" });
    expect(s.kind).toBe("progress");
    expect(s.weightKg).toBe(82.5);
    expect(s.reps).toBe(6);
  });

  it("holds the load and targets one more rep while the range is not yet topped", () => {
    const s = suggestNextLoad({ lastSets: sets(80, [8, 7, 6]), repsMin: 6, repsMax: 8, equipment: "barbell" });
    expect(s).toMatchObject({ kind: "repeat", weightKg: 80, reps: 7 });
  });

  it("does not add load after a grind (RPE ≥ 9.5) even at the top of the range", () => {
    const s = suggestNextLoad({ lastSets: sets(80, [8, 8, 8], 9.5), repsMin: 6, repsMax: 8, equipment: "barbell" });
    expect(s.kind).toBe("repeat");
    expect(s.weightKg).toBe(80);
  });

  it("ignores warm-ups and back-off sets when judging the working weight", () => {
    const s = suggestNextLoad({
      lastSets: [
        { weightKg: 40, reps: 10, isWarmup: true },
        ...sets(100, [5, 5, 5]),
        ...sets(80, [10]),
      ],
      repsMin: 3,
      repsMax: 5,
      equipment: "barbell",
    });
    expect(s).toMatchObject({ kind: "progress", weightKg: 102.5 });
  });

  it("falls back to 'start' with no usable history, and uses equipment-specific jumps", () => {
    expect(suggestNextLoad({ lastSets: [], repsMin: 8, repsMax: 12, equipment: "dumbbell" }).kind).toBe("start");
    expect(incrementFor("dumbbell")).toBe(2);
    expect(incrementFor("barbell")).toBe(2.5);
    expect(suggestNextLoad({ lastSets: sets(20, [12, 12]), repsMin: 8, repsMax: 12, equipment: "dumbbell" }).weightKg).toBe(22);
  });
});

describe("plate maths", () => {
  it("loads 100 kg on a 20 kg bar as 25+15 per side", () => {
    const r = platesPerSide(100);
    expect(r.perSide).toEqual([25, 15]);
    expect(r.loadedKg).toBe(100);
    expect(r.remainderKg).toBe(0);
  });

  it("handles fractional plates and reports what cannot be loaded", () => {
    expect(platesPerSide(62.5).perSide).toEqual([20, 1.25]);
    const odd = platesPerSide(61);
    expect(odd.loadedKg).toBe(60);
    expect(odd.remainderKg).toBe(1);
  });

  it("returns an empty list at or below the bar", () => {
    expect(platesPerSide(20).perSide).toEqual([]);
    expect(platesPerSide(10).perSide).toEqual([]);
  });

  it("supports a different bar weight", () => {
    expect(platesPerSide(55, 15).perSide).toEqual([20]);
  });
});

describe("warm-up ramp", () => {
  it("ramps up toward the working weight without ever reaching it", () => {
    const ramp = warmupRamp(100);
    expect(ramp.length).toBeGreaterThanOrEqual(3);
    const weights = ramp.map((w) => w.weightKg);
    expect([...weights].sort((a, b) => a - b)).toEqual(weights);
    expect(Math.max(...weights)).toBeLessThan(100);
    expect(ramp[0].reps).toBeGreaterThan(ramp.at(-1)!.reps);
  });

  it("skips warm-ups for loads at or below the empty bar", () => {
    expect(warmupRamp(20)).toEqual([]);
    expect(warmupRamp(15)).toEqual([]);
  });
});

describe("Persian search", () => {
  it("folds Arabic letters, ZWNJ and digits", () => {
    expect(normalizeFa("كتل‌بل ۲۰")).toBe("کتل بل 20");
    expect(normalizeFa("پرس  سينه")).toBe("پرس سینه");
  });

  it("ranks exact > prefix > substring, and finds multi-word queries in any order", () => {
    expect(matchScore("اسکوات", "اسکوات")).toBeGreaterThan(matchScore("اسکوات", "اسکوات هالتر"));
    expect(matchScore("اسکوات", "اسکوات هالتر")).toBeGreaterThan(matchScore("اسکوات", "نیم اسکوات هالتر"));
    expect(matchScore("هالتر سینه", "پرس سینه هالتر")).toBeGreaterThan(0);
  });

  it("tolerates one typo and understands gym shorthand", () => {
    expect(matchScore("ددلیفت", "ددلیفت رومانیایی")).toBeGreaterThan(0);
    expect(matchScore("ددلیقت", "ددلیفت")).toBeGreaterThan(0);
    expect(matchScore("اسکووات", "اسکوات هالتر")).toBeGreaterThan(0);
    expect(matchScore("dl", "ددلیفت هالتر")).toBeGreaterThan(0);
    expect(matchScore("ohp", "پرس سرشانه هالتر ایستاده")).toBeGreaterThan(0);
  });

  it("returns nothing for unrelated text and keeps order for an empty query", () => {
    expect(matchScore("پلانک", "پرس سینه")).toBe(0);
    const items = ["الف", "ب", "ج"];
    expect(rankBySearch(items, "  ", (x) => [x])).toEqual(items);
    expect(rankBySearch(["نیم اسکوات", "اسکوات", "پرس"], "اسکوات", (x) => [x])).toEqual(["اسکوات", "نیم اسکوات"]);
  });
});

describe("structural balance", () => {
  it("flags pressing far above pulling and suggests the fix", () => {
    const pairs = computeBalance({ chest: 12, front_delts: 6, triceps: 6, lats: 4, biceps: 2 });
    const pp = pairs.find((p) => p.key === "push_pull")!;
    expect(pp.status).toBe("lean_a");
    expect(pp.ratio).toBeLessThan(0.9);
    expect(pp.noteFa).toContain("کشش");
  });

  it("calls an even split balanced", () => {
    const pp = computeBalance({ chest: 8, triceps: 4, lats: 8, upper_back: 4 }).find((p) => p.key === "push_pull")!;
    expect(pp.status).toBe("balanced");
  });

  it("refuses to judge with too little data", () => {
    expect(computeBalance({ chest: 2 }).every((p) => p.status === "insufficient")).toBe(true);
  });
});

describe("recovery", () => {
  it("classifies by hours since the last stimulus", () => {
    expect(recoveryState(10)).toBe("recovering");
    expect(recoveryState(72)).toBe("ready");
    expect(recoveryState(24 * 10)).toBe("neglected");
    expect(recoveryState(null)).toBe("neglected");
  });
  it("paints fresher work brighter", () => {
    expect(recencyIntensity(0)).toBe(100);
    expect(recencyIntensity(48)).toBe(50);
    expect(recencyIntensity(200)).toBe(0);
    expect(recencyIntensity(null)).toBe(0);
  });
});
