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
  ExplanationQuality,
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

  const { text: explanation, quality: explanationQuality } = buildExplanation({
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
    weights,
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
    explanationQuality,
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
  weights: Weights;
  dataQuality: DataQuality;
}

interface ExplanationOutput {
  text: string;
  quality: ExplanationQuality;
}

/** Minimum number of concrete input values a good explanation should cite. */
const MIN_EXPLANATION_DATA_POINTS = 4;

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function wPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function signed(x: number): string {
  return x > 0 ? `+${x}` : `${x}`;
}

/** Per-game rate from a season-style total, or null if inputs are missing. */
function perGame(goals: number | null | undefined, matches: number | null | undefined): number | null {
  if (goals == null || matches == null || matches <= 0) return null;
  return goals / matches;
}

function buildExplanation(a: ExplainArgs): ExplanationOutput {
  const lines: string[] = [];
  // Count of concrete *input* values cited (derived numbers like ratings and
  // probabilities are not counted — only raw data the user actually entered).
  let dataPoints = 0;
  const note = (s: string) => lines.push(s);

  const h = a.home;
  const v = a.away; // visitor / away
  const stronger = a.ratingHome >= a.ratingAway ? h.name : v.name;
  const weaker = a.ratingHome >= a.ratingAway ? v.name : h.name;
  const gap = Math.abs(a.ratingHome - a.ratingAway);

  const fifaPct = wPct(a.weights.wFifa);
  const formPct = wPct(a.weights.wForm);
  const wcPct = wPct(a.weights.wWcHistory);
  const manualPct = wPct(a.weights.wManual);
  const homePct = wPct(a.weights.wHomeAdvantage);

  // Headline strength (derived rating — not counted as a raw data point).
  if (gap < 3) {
    note(
      `**Even contest.** ${h.name} (rating ${a.ratingHome.toFixed(1)}) and ${v.name} ` +
        `(rating ${a.ratingAway.toFixed(1)}) are separated by just ${gap.toFixed(1)} rating points, ` +
        `so the result is genuinely open.`,
    );
  } else {
    note(
      `**${stronger} is the stronger side**, rating ${Math.max(a.ratingHome, a.ratingAway).toFixed(1)} ` +
        `to ${Math.min(a.ratingHome, a.ratingAway).toFixed(1)} for ${weaker} — a gap of ${gap.toFixed(1)} rating points.`,
    );
  }

  // FIFA ranking — cite ranks and points explicitly.
  if (h.fifaRank != null && v.fifaRank != null) {
    const fifaLead = h.fifaRank <= v.fifaRank ? h.name : v.name;
    const hPts = h.fifaPoints != null ? ` (${h.fifaPoints.toFixed(0)} pts)` : "";
    const vPts = v.fifaPoints != null ? ` (${v.fifaPoints.toFixed(0)} pts)` : "";
    note(
      `**FIFA ranking:** ${h.name} has a FIFA rank of ${h.fifaRank}${hPts} versus ${v.name} at ` +
        `${v.fifaRank}${vPts}. This favours ${fifaLead} and is weighted at ${fifaPct} of the rating.`,
    );
    dataPoints += 2;
    if (h.fifaPoints != null) dataPoints += 1;
    if (v.fifaPoints != null) dataPoints += 1;
  } else {
    note(
      `**FIFA ranking:** not available for ${h.fifaRank == null ? h.name : v.name}, so this ${fifaPct} ` +
        `input could not be used and was treated as neutral.`,
    );
  }

  // Recent form — cite the form scores and recent goal rates.
  if (h.recentFormScore != null && v.recentFormScore != null) {
    const formLead = h.recentFormScore >= v.recentFormScore ? h.name : v.name;
    note(
      `**Recent form:** ${h.name}'s recent form score is ${Math.round(h.recentFormScore)}/100, ` +
        `compared with ${v.name} at ${Math.round(v.recentFormScore)}/100, nudging the advice toward ` +
        `${formLead}. Form carries ${formPct} weight.`,
    );
    dataPoints += 2;
  } else {
    note(
      `**Recent form:** form score missing for ${h.recentFormScore == null ? h.name : v.name}, ` +
        `so this ${formPct} input was treated as neutral and confidence is lower.`,
    );
  }

  // Recent goals scored/conceded — and the explicit effect on expected goals.
  const hConc = perGame(h.formGoalsAgainst, h.formMatches);
  const vConc = perGame(v.formGoalsAgainst, v.formMatches);
  const hScored = perGame(h.formGoalsFor, h.formMatches);
  const vScored = perGame(v.formGoalsFor, v.formMatches);
  if (hConc != null && vConc != null) {
    dataPoints += 2;
    if (hScored != null) dataPoints += 1;
    if (vScored != null) dataPoints += 1;
    const scoredBit =
      hScored != null && vScored != null
        ? ` ${h.name} have scored ${hScored.toFixed(1)} and conceded ${hConc.toFixed(1)} per game over their last ` +
          `${h.formMatches}; ${v.name} ${vScored.toFixed(1)} scored and ${vConc.toFixed(1)} conceded over their last ${v.formMatches}.`
        : ` ${h.name} have conceded ${hConc.toFixed(1)} per game and ${v.name} ${vConc.toFixed(1)}.`;
    if (Math.abs(hConc - vConc) < 0.1) {
      note(
        `**Recent goals:**${scoredBit} Their defensive records are similar, so neither side's expected ` +
          `goals gets a meaningful lift from the opponent's leakiness.`,
      );
    } else {
      const leakier = hConc > vConc ? h.name : v.name;
      const opponent = hConc > vConc ? v.name : h.name;
      note(
        `**Recent goals:**${scoredBit} ${leakier} has conceded more in recent matches ` +
          `(${Math.max(hConc, vConc).toFixed(1)} vs ${Math.min(hConc, vConc).toFixed(1)} goals per game), ` +
          `which increases ${opponent}'s expected goals.`,
      );
    }
  }

  // Attack vs defence -> expected goals, citing the actual strength values.
  const hAtk = h.attackStrength;
  const vAtk = v.attackStrength;
  const hDef = h.defenceStrength;
  const vDef = v.defenceStrength;
  if (hAtk != null && vDef != null && vAtk != null && hDef != null) {
    note(
      `**Attack vs defence:** ${h.name}'s attack (${Math.round(hAtk)}/100) meets ${v.name}'s defence ` +
        `(${Math.round(vDef)}/100), while ${v.name}'s attack (${Math.round(vAtk)}/100) meets ${h.name}'s ` +
        `defence (${Math.round(hDef)}/100). Combined with the rating gap, this produces expected goals of ` +
        `${a.xgHome.toFixed(2)} for ${h.name} and ${a.xgAway.toFixed(2)} for ${v.name}.`,
    );
    dataPoints += 4;
  } else {
    const missingAD = [
      hAtk == null ? `${h.name} attack` : null,
      hDef == null ? `${h.name} defence` : null,
      vAtk == null ? `${v.name} attack` : null,
      vDef == null ? `${v.name} defence` : null,
    ].filter(Boolean);
    note(
      `**Expected goals:** ${a.xgHome.toFixed(2)} for ${h.name} and ${a.xgAway.toFixed(2)} for ${v.name}. ` +
        `Attack/defence data is incomplete (missing: ${missingAD.join(", ")}), so the comparison fell back ` +
        `to a neutral 50/100 where values were absent.`,
    );
    if (hAtk != null) dataPoints += 1;
    if (vAtk != null) dataPoints += 1;
    if (hDef != null) dataPoints += 1;
    if (vDef != null) dataPoints += 1;
  }

  // World Cup history — cite scores and note the relative weighting.
  if (h.worldCupExperienceScore != null && v.worldCupExperienceScore != null) {
    const wcDiff = h.worldCupExperienceScore - v.worldCupExperienceScore;
    const wcLead = wcDiff >= 0 ? h.name : v.name;
    const strength = Math.abs(wcDiff) < 5 ? "is essentially level" : Math.abs(wcDiff) < 15 ? "slightly favours" : "favours";
    const verdict = strength === "is essentially level" ? "is essentially level between the two" : `${strength} ${wcLead}`;
    note(
      `**World Cup history:** experience score ${Math.round(h.worldCupExperienceScore)} (${h.name}) ` +
        `vs ${Math.round(v.worldCupExperienceScore)} (${v.name}) ${verdict}, but at ${wcPct} weight it counts ` +
        `for less than current form (${formPct}).`,
    );
    dataPoints += 2;
  } else {
    note(
      `**World Cup history:** experience score missing for ` +
        `${h.worldCupExperienceScore == null ? h.name : v.name}; this ${wcPct} input was treated as neutral.`,
    );
  }

  // Manual adjustment — only mention if actually used.
  const hAdj = h.manualAdjustment ?? 0;
  const vAdj = v.manualAdjustment ?? 0;
  if (hAdj !== 0 || vAdj !== 0) {
    note(
      `**Manual adjustment:** your overrides (injuries/motivation) of ${signed(hAdj)} for ${h.name} and ` +
        `${signed(vAdj)} for ${v.name} were applied at ${manualPct} weight.`,
    );
    if (hAdj !== 0) dataPoints += 1;
    if (vAdj !== 0) dataPoints += 1;
  }

  // Home advantage.
  if (a.context.homeAdvantage) {
    note(`**Home advantage:** applied to ${h.name} at ${homePct} weight, lifting their rating and expected goals.`);
  }

  // Probabilities + uncertainty (derived numbers).
  note(
    `**Outcome probabilities:** ${h.name} win ${pct(a.pHome)}, draw ${pct(a.pDraw)}, ${v.name} win ${pct(a.pAway)}.`,
  );
  const topP = Math.max(a.pHome, a.pDraw, a.pAway);
  if (topP < 0.42) {
    note(
      `**High uncertainty:** no outcome is clearly dominant (top outcome only ${pct(topP)}), ` +
        `so treat any exact score as a gamble.`,
    );
  }

  // Why the recommended score.
  note(
    `**Recommended score (${a.mode} mode): ${a.recommendedScore}** — ` +
      (a.mode === "safe"
        ? `chosen to back the most likely outcome with its most probable scoreline.`
        : a.mode === "aggressive"
          ? `chosen to chase the exact-score jackpot for maximum pool upside; it is less likely but higher-reward.`
          : `the scoreline with the best expected Scorito points, balancing a likely outcome with exact-score upside.`),
  );

  // When to consider alternatives.
  note(
    `**Alternatives:** play it safe with **${a.safeScore}** if you mainly want the toto/outcome points; ` +
      `go aggressive with **${a.aggressiveScore}** if you are behind in the pool and need a differentiator.`,
  );

  note(`**Confidence:** ${a.confidence}. **Risk:** ${a.risk}.`);

  // Explicit missing-data callout, per the data-quality requirement.
  const missingData = [
    ...teamDataQuality(h).missing.map((m) => `${h.name}: ${m}`),
    ...teamDataQuality(v).missing.map((m) => `${v.name}: ${m}`),
  ];
  if (missingData.length) {
    note(
      `**Missing data:** ${missingData.join("; ")}. These inputs could not be cited above and were treated ` +
        `as neutral, so weigh this advice accordingly.`,
    );
  }

  // Explanation-quality check.
  const ok = dataPoints >= MIN_EXPLANATION_DATA_POINTS;
  const warnings: string[] = [];
  if (!ok) {
    warnings.push(
      `This explanation cites only ${dataPoints} concrete data point${dataPoints === 1 ? "" : "s"} ` +
        `(fewer than the ${MIN_EXPLANATION_DATA_POINTS} expected). Add more team data for sharper, evidence-based advice.`,
    );
  }
  if (missingData.length) {
    warnings.push(`Key data missing: ${missingData.join("; ")}.`);
  }

  return {
    text: lines.join("\n\n"),
    quality: { dataPoints, ok, missingData, warnings },
  };
}
