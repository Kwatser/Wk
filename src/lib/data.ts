import type { Team } from "@prisma/client";
import { prisma } from "./prisma";
import { predictMatch } from "./model";
import {
  DEFAULT_SCORING,
  DEFAULT_WEIGHTS,
  settingsToScoring,
  settingsToWeights,
  type SettingsShape,
} from "./defaults";
import type { PredictionMode, TeamInput } from "./types";

/** Read settings, creating the singleton row on first use. */
export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.settings.create({ data: { id: 1 } });
}

function toTeamInput(t: Team): TeamInput {
  return {
    name: t.name,
    fifaRank: t.fifaRank,
    fifaPoints: t.fifaPoints,
    recentFormScore: t.recentFormScore,
    attackStrength: t.attackStrength,
    defenceStrength: t.defenceStrength,
    worldCupExperienceScore: t.worldCupExperienceScore,
    manualAdjustment: t.manualAdjustment,
    formMatches: t.formMatches,
    formWins: t.formWins,
    formDraws: t.formDraws,
    formLosses: t.formLosses,
    formGoalsFor: t.formGoalsFor,
    formGoalsAgainst: t.formGoalsAgainst,
  };
}

/**
 * Run the model for a match and persist the result. Respects an existing manual
 * override on the score (we keep the override but refresh everything else).
 */
export async function generatePrediction(matchId: number) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true, prediction: true },
  });
  if (!match) throw new Error(`Match ${matchId} not found`);

  const settings = (await getSettings()) as unknown as SettingsShape;
  const weights = settings ? settingsToWeights(settings) : DEFAULT_WEIGHTS;
  const scoring = settings ? settingsToScoring(settings) : DEFAULT_SCORING;
  const mode = (settings?.mode ?? "balanced") as PredictionMode;

  const result = predictMatch(
    toTeamInput(match.homeTeam),
    toTeamInput(match.awayTeam),
    { homeAdvantage: match.homeAdvantage },
    weights,
    scoring,
    mode,
  );

  const data = {
    mode: result.mode,
    pHome: result.pHome,
    pDraw: result.pDraw,
    pAway: result.pAway,
    xgHome: result.xgHome,
    xgAway: result.xgAway,
    recommendedScore: result.recommendedScore,
    safeScore: result.safeScore,
    aggressiveScore: result.aggressiveScore,
    confidence: result.confidence,
    risk: result.risk,
    explanation: result.explanation,
    factorsJson: JSON.stringify(result.factors),
    dataQualityJson: JSON.stringify(result.dataQuality),
    explanationQualityJson: JSON.stringify(result.explanationQuality),
  };

  return prisma.prediction.upsert({
    where: { matchId },
    create: { matchId, ...data },
    // Preserve any manual override flag/score the user set previously.
    update: data,
  });
}

export async function generateAllPredictions() {
  const matches = await prisma.match.findMany({ select: { id: true } });
  for (const m of matches) {
    await generatePrediction(m.id);
  }
  return matches.length;
}
