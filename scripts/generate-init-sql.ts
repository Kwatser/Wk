// Generates the data-insert portion of prisma/init.sql from the seed data.
//
// This lets you set up the hosted database entirely in the browser (e.g. Neon's
// SQL editor) without installing Node — no `npm run setup` required. The table
// definitions (DDL) are produced separately by `prisma migrate diff` and the two
// are concatenated by scripts/build-init-sql.sh.
//
// Predictions are intentionally NOT inserted here: after loading this SQL, open
// the deployed app and click "Regenerate all predictions" on the dashboard.

import { MATCHES, TEAMS, teamCreateData } from "../prisma/seed";

/** Marker for raw SQL that should be emitted verbatim (e.g. now()). */
const NOW = { raw: "now()" };

/** Quote a value as a SQL literal (dollar-quoting strings to avoid escaping issues). */
function lit(value: unknown): string {
  if (value && typeof value === "object" && "raw" in value) return (value as { raw: string }).raw;
  if (value === "") return "''"; // explicit empty string stays an empty string
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  const s = String(value);
  // Pick a dollar-quote tag that doesn't appear in the string.
  let tag = "$q$";
  let i = 0;
  while (s.includes(tag)) {
    tag = `$q${i++}$`;
  }
  return `${tag}${s}${tag}`;
}

function row(values: unknown[]): string {
  return `(${values.map(lit).join(", ")})`;
}

const out: string[] = [];
out.push("-- WK Pool Predictor — seed data (teams, matches, settings).");
out.push("-- Generated from prisma/seed.ts; do not edit by hand.");
out.push("");

// Settings singleton (defaults).
out.push(`INSERT INTO "Settings" ("id","mode","wFifa","wForm","wAttack","wDefence","wWcHistory","wHomeAdvantage","wManual","exactScorePoints","correctOutcomePoints","correctGoalDiffPoints","updatedAt")`);
out.push(`VALUES (1, 'balanced', 0.25, 0.25, 0.20, 0.15, 0.10, 0.03, 0.02, 8, 4, 0, now())`);
out.push(`ON CONFLICT ("id") DO NOTHING;`);
out.push("");

// Teams (explicit ids 1..N so matches can reference them).
const teamColumns = [
  "id", "name", "code", "confederation", "fifaRank", "fifaPoints", "fifaSourceUrl", "fifaUpdated",
  "formMatches", "formWins", "formDraws", "formLosses", "formGoalsFor", "formGoalsAgainst",
  "formOpponentNote", "recentFormScore", "wcAppearances", "wcBestResult", "wcRecentPerformance",
  "knockoutExperienceNote", "wcHistoryNote", "worldCupExperienceScore", "attackStrength",
  "defenceStrength", "goalkeepingNote", "squadQualityNote", "injuriesNote", "manualAdjustment",
  "dataSource", "lastUpdated", "createdAt", "updatedAt",
];
const teamId = new Map<string, number>();
out.push(`INSERT INTO "Team" (${teamColumns.map((c) => `"${c}"`).join(",")}) VALUES`);
const teamRows = TEAMS.map((t, idx) => {
  const id = idx + 1;
  teamId.set(t.name, id);
  const d = teamCreateData(t);
  return row([
    id, d.name, d.code, d.confederation, d.fifaRank, d.fifaPoints, d.fifaSourceUrl, d.fifaUpdated,
    d.formMatches, d.formWins, d.formDraws, d.formLosses, d.formGoalsFor, d.formGoalsAgainst,
    d.formOpponentNote, d.recentFormScore, d.wcAppearances, d.wcBestResult, d.wcRecentPerformance,
    d.knockoutExperienceNote, d.wcHistoryNote, d.worldCupExperienceScore, d.attackStrength,
    d.defenceStrength, d.goalkeepingNote, d.squadQualityNote, d.injuriesNote, d.manualAdjustment,
    d.dataSource, d.lastUpdated, NOW, NOW,
  ]);
});
out.push(teamRows.join(",\n") + "\nON CONFLICT (\"name\") DO NOTHING;");
out.push("");

// Matches (explicit ids referencing team ids).
const matchColumns = [
  "id", "homeTeamId", "awayTeamId", "stage", "groupMatchNumber", "venue", "homeAdvantage",
  "motivationNote", "createdAt",
];
out.push(`INSERT INTO "Match" (${matchColumns.map((c) => `"${c}"`).join(",")}) VALUES`);
const matchRows = MATCHES.map((m, idx) => {
  const id = idx + 1;
  const home = teamId.get(m.home);
  const away = teamId.get(m.away);
  if (!home || !away) throw new Error(`Match references unknown team: ${m.home} / ${m.away}`);
  return row([
    id, home, away, m.stage, m.groupMatchNumber ?? null, m.venue ?? null,
    m.homeAdvantage ?? false, m.motivationNote ?? null, NOW,
  ]);
});
out.push(matchRows.join(",\n") + ";");
out.push("");

// Keep the autoincrement sequences ahead of the explicit ids we inserted.
out.push(`SELECT setval(pg_get_serial_sequence('"Team"','id'), (SELECT MAX(id) FROM "Team"));`);
out.push(`SELECT setval(pg_get_serial_sequence('"Match"','id'), (SELECT MAX(id) FROM "Match"));`);
out.push("");

process.stdout.write(out.join("\n"));
