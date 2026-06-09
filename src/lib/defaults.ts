import type { PredictionMode, ScoringRules, Weights } from "./types";

export const DEFAULT_WEIGHTS: Weights = {
  wFifa: 0.25,
  wForm: 0.25,
  wAttack: 0.2,
  wDefence: 0.15,
  wWcHistory: 0.1,
  wHomeAdvantage: 0.03,
  wManual: 0.02,
};

export const DEFAULT_SCORING: ScoringRules = {
  // Scorito-style defaults: full points for the exact score, fewer for the toto.
  exactScorePoints: 8,
  correctOutcomePoints: 4,
  correctGoalDiffPoints: 0,
};

export const DEFAULT_MODE: PredictionMode = "balanced";

export interface SettingsShape extends Weights, ScoringRules {
  id: number;
  mode: string;
}

export function settingsToWeights(s: SettingsShape): Weights {
  return {
    wFifa: s.wFifa,
    wForm: s.wForm,
    wAttack: s.wAttack,
    wDefence: s.wDefence,
    wWcHistory: s.wWcHistory,
    wHomeAdvantage: s.wHomeAdvantage,
    wManual: s.wManual,
  };
}

export function settingsToScoring(s: SettingsShape): ScoringRules {
  return {
    exactScorePoints: s.exactScorePoints,
    correctOutcomePoints: s.correctOutcomePoints,
    correctGoalDiffPoints: s.correctGoalDiffPoints,
  };
}
