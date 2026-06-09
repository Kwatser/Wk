import { describe, expect, it } from "vitest";
import {
  COMMON_SCORES,
  clamp,
  normaliseFifaPoints,
  normaliseFifaRank,
  predictMatch,
} from "./model";
import type { ScoringRules, TeamInput, Weights } from "./types";

const weights: Weights = {
  wFifa: 0.25,
  wForm: 0.25,
  wAttack: 0.2,
  wDefence: 0.15,
  wWcHistory: 0.1,
  wHomeAdvantage: 0.03,
  wManual: 0.02,
};

const scoring: ScoringRules = {
  exactScorePoints: 8,
  correctOutcomePoints: 4,
  correctGoalDiffPoints: 0,
};

const strong: TeamInput = {
  name: "Strongland",
  fifaRank: 1,
  fifaPoints: 1880,
  recentFormScore: 85,
  attackStrength: 88,
  defenceStrength: 82,
  worldCupExperienceScore: 90,
  manualAdjustment: 0,
  formMatches: 10,
  formGoalsFor: 24,
  formGoalsAgainst: 5,
};

const weak: TeamInput = {
  name: "Weaktopia",
  fifaRank: 80,
  fifaPoints: 1250,
  recentFormScore: 40,
  attackStrength: 45,
  defenceStrength: 48,
  worldCupExperienceScore: 30,
  manualAdjustment: 0,
  formMatches: 10,
  formGoalsFor: 9,
  formGoalsAgainst: 18,
};

describe("normalisation helpers", () => {
  it("clamps", () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
  });
  it("maps FIFA points into 0-100", () => {
    expect(normaliseFifaPoints(1000)).toBe(0);
    expect(normaliseFifaPoints(1900)).toBe(100);
    expect(normaliseFifaPoints(1450)).toBeCloseTo(50, 0);
  });
  it("maps FIFA rank into 0-100 with #1 highest", () => {
    expect(normaliseFifaRank(1)).toBe(100);
    expect(normaliseFifaRank(1)).toBeGreaterThan(normaliseFifaRank(20));
  });
});

describe("predictMatch", () => {
  it("produces probabilities that sum to ~1", () => {
    const r = predictMatch(strong, weak, { homeAdvantage: false }, weights, scoring, "balanced");
    expect(r.pHome + r.pDraw + r.pAway).toBeCloseTo(1, 5);
  });

  it("favours the stronger team", () => {
    const r = predictMatch(strong, weak, { homeAdvantage: false }, weights, scoring, "balanced");
    expect(r.pHome).toBeGreaterThan(r.pAway);
    expect(r.xgHome).toBeGreaterThan(r.xgAway);
    expect(r.ratingHome).toBeGreaterThan(r.ratingAway);
  });

  it("gives the home team a boost when home advantage is on", () => {
    const off = predictMatch(strong, strong, { homeAdvantage: false }, weights, scoring, "balanced");
    const on = predictMatch(strong, strong, { homeAdvantage: true }, weights, scoring, "balanced");
    expect(on.pHome).toBeGreaterThan(off.pHome);
    expect(on.ratingHome).toBeGreaterThan(off.ratingHome);
  });

  it("recommends a realistic common scoreline in balanced mode for a close game", () => {
    const r = predictMatch(strong, strong, { homeAdvantage: false }, weights, scoring, "balanced");
    const common = COMMON_SCORES.map(([h, a]) => `${h}-${a}`);
    expect(common).toContain(r.recommendedScore);
  });

  it("flags low data quality when inputs are missing", () => {
    const sparse: TeamInput = { name: "Sparse", manualAdjustment: 0 };
    const r = predictMatch(sparse, weak, { homeAdvantage: false }, weights, scoring, "balanced");
    expect(r.dataQuality.completeness).toBeLessThan(1);
    expect(r.dataQuality.warnings.length).toBeGreaterThan(0);
    expect(r.risk).toBe("High");
  });

  it("reports higher confidence for a clear mismatch than an even game", () => {
    const mismatch = predictMatch(strong, weak, { homeAdvantage: false }, weights, scoring, "balanced");
    const even = predictMatch(strong, strong, { homeAdvantage: false }, weights, scoring, "balanced");
    const order = { Low: 0, Medium: 1, High: 2 } as const;
    expect(order[mismatch.confidence]).toBeGreaterThanOrEqual(order[even.confidence]);
  });

  it("includes a written explanation that mentions both teams", () => {
    const r = predictMatch(strong, weak, { homeAdvantage: false }, weights, scoring, "balanced");
    expect(r.explanation).toContain("Strongland");
    expect(r.explanation).toContain("Weaktopia");
    expect(r.explanation.length).toBeGreaterThan(200);
  });

  it("cites the actual FIFA ranks and form scores in the explanation", () => {
    const r = predictMatch(strong, weak, { homeAdvantage: false }, weights, scoring, "balanced");
    // Concrete FIFA ranks for both teams.
    expect(r.explanation).toContain("FIFA rank of 1");
    expect(r.explanation).toContain("80");
    // Concrete form scores out of 100.
    expect(r.explanation).toContain("85/100");
    expect(r.explanation).toContain("40/100");
    // Concrete attack/defence values.
    expect(r.explanation).toMatch(/attack \(88\/100\)/);
  });

  it("explains that the leakier defence raises the opponent's expected goals", () => {
    const r = predictMatch(strong, weak, { homeAdvantage: false }, weights, scoring, "balanced");
    // Weaktopia concedes 1.8/game vs Strongland's 0.5/game.
    expect(r.explanation).toContain("conceded more");
    expect(r.explanation).toContain("increases Strongland's expected goals");
  });

  it("passes the explanation-quality check with full data (>= 4 data points)", () => {
    const r = predictMatch(strong, weak, { homeAdvantage: false }, weights, scoring, "balanced");
    expect(r.explanationQuality.dataPoints).toBeGreaterThanOrEqual(4);
    expect(r.explanationQuality.ok).toBe(true);
    expect(r.explanationQuality.missingData).toHaveLength(0);
    expect(r.explanationQuality.warnings).toHaveLength(0);
  });

  it("warns and lists missing data when inputs are sparse", () => {
    const sparse: TeamInput = { name: "Sparse", fifaRank: 50, manualAdjustment: 0 };
    const alsoSparse: TeamInput = { name: "AlsoSparse", manualAdjustment: 0 };
    const r = predictMatch(sparse, alsoSparse, { homeAdvantage: false }, weights, scoring, "balanced");
    expect(r.explanationQuality.dataPoints).toBeLessThan(4);
    expect(r.explanationQuality.ok).toBe(false);
    expect(r.explanationQuality.warnings.join(" ")).toMatch(/fewer than the 4 expected/);
    // Missing key data is named explicitly (e.g. attack/defence/form).
    expect(r.explanationQuality.missingData.length).toBeGreaterThan(0);
    expect(r.explanation).toContain("Missing data:");
  });

  it("avoids vague unsupported phrasing", () => {
    const r = predictMatch(strong, weak, { homeAdvantage: false }, weights, scoring, "balanced");
    expect(r.explanation.toLowerCase()).not.toContain("based on overall quality");
  });

  it("aggressive mode tends to pick a more differentiated score than safe mode", () => {
    const safe = predictMatch(strong, weak, { homeAdvantage: false }, weights, scoring, "safe");
    const aggressive = predictMatch(strong, weak, { homeAdvantage: false }, weights, scoring, "aggressive");
    const goals = (s: string) => s.split("-").reduce((a, b) => a + Number(b), 0);
    expect(goals(aggressive.aggressiveScore)).toBeGreaterThanOrEqual(goals(safe.safeScore));
  });
});
