// ─────────────────────────────────────────────────────────────────────────────
// WK Pool Predictor — transparent, rule-based prediction model.
//
// The model is deliberately NOT a black box. Every step is a simple, documented
// transformation so the written explanation can faithfully describe what happened:
//
//   1. Normalise each input onto a 0-100 "rating" scale.
//   2. Combine them with configurable weights into a base team rating.
//   3. Apply home advantage and manual adjustment.
//   4. Convert the rating DIFFERENCE into a goal supremacy, and the attack/defence
//      levels into a total-goals expectation -> expected goals per team.
//   5. Build an independent-Poisson score matrix.
//   6. Derive 1X2 probabilities and pick recommended / safe / aggressive scores
//      using the configured Scorito scoring rules.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  DataQuality,
  FactorBreakdown,
  MatchContext,
  PredictionMode,
  PredictionResult,
  ScoringRules,
  TeamInput,
  Weights,
} from "./types";

const MAX_GOALS = 6; // matrix dimension (0..6 goals per team)

// Tuning constants (kept few and explicit).
const SUPREMACY_PER_RATING_POINT = 0.028; // 10-pt gap ≈ 0.28 goal supremacy
const BASE_TOTAL_GOALS = 2.6; // average goals in an evenly matched game
const MIN_XG = 0.18;
const MAX_XG = 3.6;
const HOME_ADVANTAGE_RATING_BONUS = 100; // scaled by wHomeAdvantage (e.g. 0.03 -> 3 pts)
const MANUAL_RATING_PER_STEP = 100; // a +1 manual step ≈ wManual*... scaled below

/** Realistic, commonly-occurring scorelines we prefer to recommend. */
export const COMMON_SCORES: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 0],
  [0, 2],
  [2, 1],
  [1, 2],
  [3, 1],
  [1, 3],
  [2, 2],
];

/** Extra scorelines allowed only when the strength gap is large. */
const BLOWOUT_SCORES: Array<[number, number]> = [
  [3, 0],
  [0, 3],
  [4, 0],
  [0, 4],
  [4, 1],
  [1, 4],
  [3, 2],
  [2, 3],
];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Map FIFA points (~1000..1900 in practice) onto 0-100. */
export function normaliseFifaPoints(points: number): number {
  return clamp(((points - 1000) / (1900 - 1000)) * 100, 0, 100);
}

/** Fallback: map FIFA rank onto 0-100 when points are missing. */
export function normaliseFifaRank(rank: number): number {
  // Rank 1 -> ~100, rank 50 -> ~25, rank 100+ -> ~0.
  return clamp(100 - (rank - 1) * 1.5, 0, 100);
}

function poisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let factorial = 1;
  for (let i = 2; i <= k; i++) factorial *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial;
}

// ── Step 1+2: base rating from weighted inputs ──────────────────────────────

interface RatingDetail {
  rating: number; // base rating before home/manual adjustments
  fifaNorm: number | null;
  form: number | null;
  attack: number | null;
  defence: number | null;
  wcExp: number | null;
}

function teamRating(team: TeamInput, w: Weights): RatingDetail {
  const fifaNorm =
    team.fifaPoints != null
      ? normaliseFifaPoints(team.fifaPoints)
      : team.fifaRank != null
        ? normaliseFifaRank(team.fifaRank)
        : null;
  const form = team.recentFormScore ?? null;
  const attack = team.attackStrength ?? null;
  const defence = team.defenceStrength ?? null;
  const wcExp = team.worldCupExperienceScore ?? null;

  // Weighted average over whichever core metrics are present (so missing data
  // doesn't silently drag a team to zero — it just reduces confidence).
  const parts: Array<[number | null, number]> = [
    [fifaNorm, w.wFifa],
    [form, w.wForm],
    [attack, w.wAttack],
    [defence, w.wDefence],
    [wcExp, w.wWcHistory],
  ];
  let sum = 0;
  let weightSum = 0;
  for (const [value, weight] of parts) {
    if (value != null) {
      sum += value * weight;
      weightSum += weight;
    }
  }
  const rating = weightSum > 0 ? sum / weightSum : 50; // neutral if nothing known
  return { rating, fifaNorm, form, attack, defence, wcExp };
}

// ── Data quality ────────────────────────────────────────────────────────────

function teamDataQuality(team: TeamInput): { present: number; total: number; missing: string[] } {
  const required: Array<[string, unknown]> = [
    ["FIFA points/rank", team.fifaPoints ?? team.fifaRank],
    ["recent form score", team.recentFormScore],
    ["attack strength", team.attackStrength],
    ["defence strength", team.defenceStrength],
    ["World Cup experience score", team.worldCupExperienceScore],
  ];
  const missing = required.filter(([, v]) => v == null).map(([label]) => label);
  return { present: required.length - missing.length, total: required.length, missing };
}

function assessDataQuality(home: TeamInput, away: TeamInput): DataQuality {
  const h = teamDataQuality(home);
  const a = teamDataQuality(away);
  const completeness = (h.present + a.present) / (h.total + a.total);
  const warnings: string[] = [];
  if (h.missing.length) warnings.push(`${home.name} is missing: ${h.missing.join(", ")}.`);
  if (a.missing.length) warnings.push(`${away.name} is missing: ${a.missing.join(", ")}.`);
  if (completeness < 1) {
    warnings.push(
      "Some inputs are incomplete, so this prediction is less reliable than a fully-populated one.",
    );
  }
  return { completeness, warnings };
}

// ── Scoreline selection helpers ─────────────────────────────────────────────

type Matrix = number[][];

function scoreMatrix(xgHome: number, xgAway: number): Matrix {
  const m: Matrix = [];
  for (let i = 0; i <= MAX_GOALS; i++) {
    m[i] = [];
    for (let j = 0; j <= MAX_GOALS; j++) {
      m[i][j] = poisson(i, xgHome) * poisson(j, xgAway);
    }
  }
  return m;
}

function outcomeProbabilities(m: Matrix): { pHome: number; pDraw: number; pAway: number } {
  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      if (i > j) pHome += m[i][j];
      else if (i === j) pDraw += m[i][j];
      else pAway += m[i][j];
    }
  }
  return { pHome, pDraw, pAway };
}

function outcomeOf(h: number, a: number): "home" | "draw" | "away" {
  if (h > a) return "home";
  if (h === a) return "draw";
  return "away";
}

function fmt([h, a]: [number, number]): string {
  return `${h}-${a}`;
}

/** Expected Scorito points for predicting a given scoreline. */
function expectedPoints(
  pred: [number, number],
  m: Matrix,
  outcomeP: { pHome: number; pDraw: number; pAway: number },
  rules: ScoringRules,
): number {
  const [ph, pa] = pred;
  const pExact = m[ph]?.[pa] ?? 0;
  const oc = outcomeOf(ph, pa);
  const pOutcome = oc === "home" ? outcomeP.pHome : oc === "draw" ? outcomeP.pDraw : outcomeP.pAway;
  // Exact reward already includes getting the outcome right; the consolation
  // (correct outcome but wrong exact) uses correctOutcomePoints.
  return (
    rules.exactScorePoints * pExact +
    rules.correctOutcomePoints * Math.max(0, pOutcome - pExact)
  );
}

function probExact(pred: [number, number], m: Matrix): number {
  return m[pred[0]]?.[pred[1]] ?? 0;
}

// ── Main entry point ────────────────────────────────────────────────────────

export function predictMatch(
  home: TeamInput,
  away: TeamInput,
  context: MatchContext,
  weights: Weights,
  scoring: ScoringRules,
  mode: PredictionMode,
): PredictionResult {
  const hr = teamRating(home, weights);
  const ar = teamRating(away, weights);

  // Step 3: home advantage + manual adjustment (in rating points).
  const homeBonus = context.homeAdvantage ? weights.wHomeAdvantage * HOME_ADVANTAGE_RATING_BONUS : 0;
  const homeManual = (home.manualAdjustment ?? 0) * weights.wManual * MANUAL_RATING_PER_STEP;
  const awayManual = (away.manualAdjustment ?? 0) * weights.wManual * MANUAL_RATING_PER_STEP;

  const ratingHome = clamp(hr.rating + homeBonus + homeManual, 0, 110);
  const ratingAway = clamp(ar.rating + awayManual, 0, 110);

  // Step 4: rating diff -> supremacy; attack/defence -> total goals.
  const diff = ratingHome - ratingAway;
  const supremacy = diff * SUPREMACY_PER_RATING_POINT;

  const avgAttack = ((hr.attack ?? 50) + (ar.attack ?? 50)) / 2;
  const avgDefence = ((hr.defence ?? 50) + (ar.defence ?? 50)) / 2;
  // More combined attack => more goals; more combined defence => fewer.
  const total = clamp((BASE_TOTAL_GOALS * (avgAttack / 50)) / (avgDefence / 50), 1.4, 3.8);

  const xgHome = clamp((total + supremacy) / 2, MIN_XG, MAX_XG);
  const xgAway = clamp((total - supremacy) / 2, MIN_XG, MAX_XG);

  // Step 5: score matrix + outcome probabilities.
  const matrix = scoreMatrix(xgHome, xgAway);
  const { pHome, pDraw, pAway } = outcomeProbabilities(matrix);
  const norm = pHome + pDraw + pAway || 1;

  // Step 6: scoreline recommendations.
  const gapIsLarge = Math.abs(diff) > 22 || Math.abs(supremacy) > 1.3;
  const candidatePool: Array<[number, number]> = gapIsLarge
    ? [...COMMON_SCORES, ...BLOWOUT_SCORES]
    : COMMON_SCORES;

  // SAFE: back the single most likely outcome, then its most-probable scoreline.
  const topOutcome = outcomeOf(
    pHome >= pDraw && pHome >= pAway ? 1 : 0,
    pAway > pHome && pAway >= pDraw ? 1 : 0,
  );
  const safeCandidates = candidatePool.filter((s) => outcomeOf(s[0], s[1]) === topOutcome);
  const safeScore = fmt(
    (safeCandidates.length ? safeCandidates : candidatePool).reduce((best, s) =>
      probExact(s, matrix) > probExact(best, matrix) ? s : best,
    ),
  );

  // BALANCED: maximise expected Scorito points (exact + outcome consolation).
  const balancedScore = fmt(
    candidatePool.reduce((best, s) =>
      expectedPoints(s, matrix, { pHome, pDraw, pAway }, scoring) >
      expectedPoints(best, matrix, { pHome, pDraw, pAway }, scoring)
        ? s
        : best,
    ),
  );

  // AGGRESSIVE: chase the exact-score jackpot from the wider pool; tie-break
  // toward more differentiated (higher-scoring) lines for pool upside.
  const aggressiveScore = fmt(
    [...COMMON_SCORES, ...BLOWOUT_SCORES].reduce((best, s) => {
      const sP = probExact(s, matrix);
      const bP = probExact(best, matrix);
      if (sP > bP + 1e-9) return s;
      if (Math.abs(sP - bP) <= 1e-9 && s[0] + s[1] > best[0] + best[1]) return s;
      return best;
    }),
  );

  const recommendedScore =
    mode === "safe" ? safeScore : mode === "aggressive" ? aggressiveScore : balancedScore;

  // Confidence from the strength of the leading outcome.
  const topP = Math.max(pHome, pDraw, pAway) / norm;
  const confidence = topP > 0.55 ? "High" : topP > 0.42 ? "Medium" : "Low";

  // Data quality + risk.
  const dataQuality = assessDataQuality(home, away);
  let risk: PredictionResult["risk"];
  if (confidence === "High" && dataQuality.completeness === 1) risk = "Low";
  else if (confidence === "Low" || dataQuality.completeness < 0.7) risk = "High";
  else risk = "Medium";

  const factors = buildFactors(hr, ar, weights, homeBonus, homeManual, awayManual);

  const explanation = buildExplanation({
    home,
    away,
    hr,
    ar,
    ratingHome,
    ratingAway,
    xgHome,
    xgAway,
    pHome: pHome / norm,
    pDraw: pDraw / norm,
    pAway: pAway / norm,
    recommendedScore,
    safeScore,
    aggressiveScore,
    confidence,
    risk,
    context,
    mode,
    dataQuality,
  });

  return {
    mode,
    pHome: pHome / norm,
    pDraw: pDraw / norm,
    pAway: pAway / norm,
    xgHome,
    xgAway,
    ratingHome,
    ratingAway,
    recommendedScore,
    safeScore,
    aggressiveScore,
    confidence,
    risk,
    factors,
    dataQuality,
    explanation,
  };
}

function buildFactors(
  hr: RatingDetail,
  ar: RatingDetail,
  w: Weights,
  homeBonus: number,
  homeManual: number,
  awayManual: number,
): FactorBreakdown[] {
  const core: Array<[string, number, number | null, number | null]> = [
    ["FIFA ranking", w.wFifa, hr.fifaNorm, ar.fifaNorm],
    ["Recent form", w.wForm, hr.form, ar.form],
    ["Attack strength", w.wAttack, hr.attack, ar.attack],
    ["Defence strength", w.wDefence, hr.defence, ar.defence],
    ["World Cup history", w.wWcHistory, hr.wcExp, ar.wcExp],
  ];
  const factors: FactorBreakdown[] = core.map(([label, weight, hv, av]) => ({
    label,
    weightPct: Math.round(weight * 100),
    homeValue: hv,
    awayValue: av,
    contribution: ((hv ?? 50) - (av ?? 50)) * weight,
  }));
  factors.push({
    label: "Home advantage",
    weightPct: Math.round(w.wHomeAdvantage * 100),
    homeValue: homeBonus > 0 ? 100 : 0,
    awayValue: 0,
    contribution: homeBonus,
  });
  factors.push({
    label: "Manual adjustment",
    weightPct: Math.round(w.wManual * 100),
    homeValue: null,
    awayValue: null,
    contribution: homeManual - awayManual,
  });
  return factors;
}

// ── Human-readable explanation ──────────────────────────────────────────────

interface ExplainArgs {
  home: TeamInput;
  away: TeamInput;
  hr: RatingDetail;
  ar: RatingDetail;
  ratingHome: number;
  ratingAway: number;
  xgHome: number;
  xgAway: number;
  pHome: number;
  pDraw: number;
  pAway: number;
  recommendedScore: string;
  safeScore: string;
  aggressiveScore: string;
  confidence: string;
  risk: string;
  context: MatchContext;
  mode: PredictionMode;
  dataQuality: DataQuality;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function buildExplanation(a: ExplainArgs): string {
  const lines: string[] = [];
  const stronger = a.ratingHome >= a.ratingAway ? a.home.name : a.away.name;
  const weaker = a.ratingHome >= a.ratingAway ? a.away.name : a.home.name;
  const gap = Math.abs(a.ratingHome - a.ratingAway);

  // Which team is stronger and why.
  if (gap < 3) {
    lines.push(
      `**Even contest.** ${a.home.name} (rating ${a.ratingHome.toFixed(1)}) and ${a.away.name} ` +
        `(rating ${a.ratingAway.toFixed(1)}) are very close, so the result is genuinely open.`,
    );
  } else {
    lines.push(
      `**${stronger} is the stronger side** (rating ${Math.max(a.ratingHome, a.ratingAway).toFixed(1)} ` +
        `vs ${Math.min(a.ratingHome, a.ratingAway).toFixed(1)} for ${weaker}), a gap of ${gap.toFixed(1)} rating points.`,
    );
  }

  // FIFA ranking influence.
  if (a.hr.fifaNorm != null && a.ar.fifaNorm != null) {
    const fifaLead = a.hr.fifaNorm >= a.ar.fifaNorm ? a.home.name : a.away.name;
    lines.push(
      `**FIFA ranking:** ${a.home.name} ${a.home.fifaRank ? `(#${a.home.fifaRank})` : ""} vs ` +
        `${a.away.name} ${a.away.fifaRank ? `(#${a.away.fifaRank})` : ""} — this favours ${fifaLead} ` +
        `and pulls the rating in their direction.`,
    );
  } else {
    lines.push(`**FIFA ranking:** incomplete, so it contributed less than usual to the rating.`);
  }

  // Recent form influence.
  if (a.hr.form != null && a.ar.form != null) {
    const formLead = a.hr.form >= a.ar.form ? a.home.name : a.away.name;
    lines.push(
      `**Recent form:** form scores are ${Math.round(a.hr.form)} (${a.home.name}) vs ` +
        `${Math.round(a.ar.form)} (${a.away.name}), nudging the advice toward ${formLead}.`,
    );
  } else {
    lines.push(`**Recent form:** missing for at least one side, lowering confidence.`);
  }

  // World Cup history influence.
  if (a.hr.wcExp != null && a.ar.wcExp != null) {
    const wcLead = a.hr.wcExp >= a.ar.wcExp ? a.home.name : a.away.name;
    lines.push(
      `**World Cup history:** tournament pedigree leans toward ${wcLead} ` +
        `(${Math.round(a.hr.wcExp)} vs ${Math.round(a.ar.wcExp)}), which matters most in tight knockout-style games.`,
    );
  }

  // Attack/defence -> expected goals.
  lines.push(
    `**Expected goals:** the attack-vs-defence comparison and the rating gap produce ` +
      `xG of ${a.xgHome.toFixed(2)} for ${a.home.name} and ${a.xgAway.toFixed(2)} for ${a.away.name}.`,
  );

  // Home advantage.
  if (a.context.homeAdvantage) {
    lines.push(`**Home advantage** was applied to ${a.home.name}, boosting their rating and xG.`);
  }

  // Probabilities + uncertainty.
  lines.push(
    `**Outcome probabilities:** ${a.home.name} win ${pct(a.pHome)}, draw ${pct(a.pDraw)}, ` +
      `${a.away.name} win ${pct(a.pAway)}.`,
  );
  const topP = Math.max(a.pHome, a.pDraw, a.pAway);
  if (topP < 0.42) {
    lines.push(
      `**High uncertainty:** no outcome is clearly dominant (top outcome only ${pct(topP)}), ` +
        `so treat any exact score as a gamble.`,
    );
  }

  // Why the recommended score.
  lines.push(
    `**Recommended score (${a.mode} mode): ${a.recommendedScore}** — ` +
      (a.mode === "safe"
        ? `chosen to back the most likely outcome with its most probable scoreline.`
        : a.mode === "aggressive"
          ? `chosen to chase the exact-score jackpot for maximum pool upside; it is less likely but higher-reward.`
          : `the scoreline with the best expected Scorito points, balancing a likely outcome with exact-score upside.`),
  );

  // When to consider alternatives.
  lines.push(
    `**Alternatives:** play it safe with **${a.safeScore}** if you mainly want the toto/outcome points; ` +
      `go aggressive with **${a.aggressiveScore}** if you are behind in the pool and need a differentiator.`,
  );

  // Confidence / risk / data quality.
  lines.push(`**Confidence:** ${a.confidence}. **Risk:** ${a.risk}.`);
  if (a.dataQuality.warnings.length) {
    lines.push(`**Data quality:** ${a.dataQuality.warnings.join(" ")}`);
  }

  return lines.join("\n\n");
}
