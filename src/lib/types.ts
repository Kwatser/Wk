// Shared types for the prediction model. These are decoupled from Prisma so the
// model is a set of pure, testable functions.

export type PredictionMode = "safe" | "balanced" | "aggressive";

export interface Weights {
  wFifa: number;
  wForm: number;
  wAttack: number;
  wDefence: number;
  wWcHistory: number;
  wHomeAdvantage: number;
  wManual: number;
}

export interface ScoringRules {
  exactScorePoints: number;
  correctOutcomePoints: number;
  correctGoalDiffPoints: number;
}

/** The subset of team fields the model actually consumes. */
export interface TeamInput {
  name: string;
  fifaRank?: number | null;
  fifaPoints?: number | null;
  recentFormScore?: number | null;
  attackStrength?: number | null;
  defenceStrength?: number | null;
  worldCupExperienceScore?: number | null;
  manualAdjustment?: number | null;
}

export interface MatchContext {
  /** True when the home team is the host nation / plays at home. */
  homeAdvantage: boolean;
}

export interface FactorBreakdown {
  label: string;
  weightPct: number;
  homeValue: number | null;
  awayValue: number | null;
  /** Contribution to the rating difference (home - away), in rating points. */
  contribution: number;
}

export interface DataQuality {
  /** 0..1 share of required inputs that are present. */
  completeness: number;
  warnings: string[];
}

export interface PredictionResult {
  mode: PredictionMode;
  pHome: number;
  pDraw: number;
  pAway: number;
  xgHome: number;
  xgAway: number;
  ratingHome: number;
  ratingAway: number;
  recommendedScore: string;
  safeScore: string;
  aggressiveScore: string;
  confidence: "High" | "Medium" | "Low";
  risk: "Low" | "Medium" | "High";
  factors: FactorBreakdown[];
  dataQuality: DataQuality;
  explanation: string;
}
