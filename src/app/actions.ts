"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateAllPredictions, generatePrediction } from "@/lib/data";

// ── helpers ──────────────────────────────────────────────────────────────────

function num(form: FormData, key: string): number | null {
  const v = form.get(key);
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function int(form: FormData, key: string): number | null {
  const n = num(form, key);
  return n == null ? null : Math.round(n);
}

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

function bool(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "true";
}

// ── Teams ────────────────────────────────────────────────────────────────────

function teamDataFromForm(form: FormData) {
  return {
    code: str(form, "code") ?? "",
    confederation: str(form, "confederation"),
    fifaRank: int(form, "fifaRank"),
    fifaPoints: num(form, "fifaPoints"),
    fifaSourceUrl: str(form, "fifaSourceUrl"),
    fifaUpdated: str(form, "fifaUpdated"),
    formMatches: int(form, "formMatches"),
    formWins: int(form, "formWins"),
    formDraws: int(form, "formDraws"),
    formLosses: int(form, "formLosses"),
    formGoalsFor: int(form, "formGoalsFor"),
    formGoalsAgainst: int(form, "formGoalsAgainst"),
    formOpponentNote: str(form, "formOpponentNote"),
    recentFormScore: num(form, "recentFormScore"),
    wcAppearances: int(form, "wcAppearances"),
    wcBestResult: str(form, "wcBestResult"),
    wcRecentPerformance: str(form, "wcRecentPerformance"),
    knockoutExperienceNote: str(form, "knockoutExperienceNote"),
    wcHistoryNote: str(form, "wcHistoryNote"),
    worldCupExperienceScore: num(form, "worldCupExperienceScore"),
    attackStrength: num(form, "attackStrength"),
    defenceStrength: num(form, "defenceStrength"),
    goalkeepingNote: str(form, "goalkeepingNote"),
    squadQualityNote: str(form, "squadQualityNote"),
    injuriesNote: str(form, "injuriesNote"),
    manualAdjustment: num(form, "manualAdjustment") ?? 0,
    dataSource: str(form, "dataSource"),
    lastUpdated: str(form, "lastUpdated"),
  };
}

export async function createTeam(form: FormData) {
  const name = str(form, "name");
  if (!name) throw new Error("Team name is required");
  const team = await prisma.team.create({ data: { name, ...teamDataFromForm(form) } });
  revalidatePath("/teams");
  redirect(`/teams/${team.id}`);
}

export async function updateTeam(id: number, form: FormData) {
  const name = str(form, "name");
  await prisma.team.update({
    where: { id },
    data: { ...(name ? { name } : {}), ...teamDataFromForm(form) },
  });
  // Team data changed — refresh predictions that depend on it.
  const matches = await prisma.match.findMany({
    where: { OR: [{ homeTeamId: id }, { awayTeamId: id }], prediction: { isNot: null } },
    select: { id: true },
  });
  for (const m of matches) await generatePrediction(m.id);
  revalidatePath("/teams");
  revalidatePath(`/teams/${id}`);
  revalidatePath("/matches");
  redirect("/teams");
}

export async function deleteTeam(id: number) {
  // Remove matches (and predictions) that reference this team first.
  await prisma.match.deleteMany({ where: { OR: [{ homeTeamId: id }, { awayTeamId: id }] } });
  await prisma.team.delete({ where: { id } });
  revalidatePath("/teams");
  revalidatePath("/matches");
  redirect("/teams");
}

// ── Matches ──────────────────────────────────────────────────────────────────

function matchDataFromForm(form: FormData) {
  return {
    homeTeamId: int(form, "homeTeamId")!,
    awayTeamId: int(form, "awayTeamId")!,
    stage: str(form, "stage"),
    groupMatchNumber: int(form, "groupMatchNumber"),
    kickoff: str(form, "kickoff"),
    venue: str(form, "venue"),
    homeAdvantage: bool(form, "homeAdvantage"),
    motivationNote: str(form, "motivationNote"),
    contextNote: str(form, "contextNote"),
  };
}

export async function createMatch(form: FormData) {
  const data = matchDataFromForm(form);
  if (!data.homeTeamId || !data.awayTeamId) throw new Error("Both teams are required");
  if (data.homeTeamId === data.awayTeamId) throw new Error("A team cannot play itself");
  const match = await prisma.match.create({ data });
  await generatePrediction(match.id);
  revalidatePath("/matches");
  redirect(`/matches/${match.id}`);
}

export async function updateMatch(id: number, form: FormData) {
  const data = matchDataFromForm(form);
  if (data.homeTeamId === data.awayTeamId) throw new Error("A team cannot play itself");
  await prisma.match.update({ where: { id }, data });
  await generatePrediction(id);
  revalidatePath("/matches");
  revalidatePath(`/matches/${id}`);
  redirect(`/matches/${id}`);
}

export async function deleteMatch(id: number) {
  await prisma.match.delete({ where: { id } });
  revalidatePath("/matches");
  redirect("/matches");
}

export async function regeneratePrediction(matchId: number) {
  await generatePrediction(matchId);
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/matches");
}

export async function regenerateAll() {
  await generateAllPredictions();
  revalidatePath("/matches");
  revalidatePath("/");
}

export async function setOverride(matchId: number, form: FormData) {
  const overrideScore = str(form, "overrideScore");
  await prisma.prediction.update({
    where: { matchId },
    data: {
      manualOverride: !!overrideScore,
      overrideScore: overrideScore,
    },
  });
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/matches");
}

export async function clearOverride(matchId: number) {
  await prisma.prediction.update({
    where: { matchId },
    data: { manualOverride: false, overrideScore: null },
  });
  revalidatePath(`/matches/${matchId}`);
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function updateSettings(form: FormData) {
  const data = {
    mode: str(form, "mode") ?? "balanced",
    wFifa: num(form, "wFifa") ?? 0.25,
    wForm: num(form, "wForm") ?? 0.25,
    wAttack: num(form, "wAttack") ?? 0.2,
    wDefence: num(form, "wDefence") ?? 0.15,
    wWcHistory: num(form, "wWcHistory") ?? 0.1,
    wHomeAdvantage: num(form, "wHomeAdvantage") ?? 0.03,
    wManual: num(form, "wManual") ?? 0.02,
    exactScorePoints: num(form, "exactScorePoints") ?? 8,
    correctOutcomePoints: num(form, "correctOutcomePoints") ?? 4,
    correctGoalDiffPoints: num(form, "correctGoalDiffPoints") ?? 0,
  };
  await prisma.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  // Re-run every prediction so weight/mode changes take effect immediately.
  await generateAllPredictions();
  revalidatePath("/settings");
  revalidatePath("/matches");
  revalidatePath("/");
  redirect("/settings?saved=1");
}
