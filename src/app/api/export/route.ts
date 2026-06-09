import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const matches = await prisma.match.findMany({
    include: { homeTeam: true, awayTeam: true, prediction: true },
    orderBy: [{ kickoff: "asc" }, { id: "asc" }],
  });

  const headers = [
    "Stage",
    "Venue",
    "Home",
    "Away",
    "Mode",
    "Recommended",
    "Safe",
    "Aggressive",
    "Override",
    "Final pick",
    "Home win %",
    "Draw %",
    "Away win %",
    "xG home",
    "xG away",
    "Confidence",
    "Risk",
    "Data completeness %",
  ];

  const rows = matches.map((m) => {
    const p = m.prediction;
    const finalPick = p?.manualOverride && p.overrideScore ? p.overrideScore : (p?.recommendedScore ?? "");
    let completeness = "";
    if (p) {
      try {
        completeness = String(Math.round((JSON.parse(p.dataQualityJson).completeness ?? 1) * 100));
      } catch {
        completeness = "";
      }
    }
    return [
      m.stage ?? "",
      m.venue ?? "",
      m.homeTeam.name,
      m.awayTeam.name,
      p?.mode ?? "",
      p?.recommendedScore ?? "",
      p?.safeScore ?? "",
      p?.aggressiveScore ?? "",
      p?.overrideScore ?? "",
      finalPick,
      p ? Math.round(p.pHome * 100) : "",
      p ? Math.round(p.pDraw * 100) : "",
      p ? Math.round(p.pAway * 100) : "",
      p ? p.xgHome.toFixed(2) : "",
      p ? p.xgAway.toFixed(2) : "",
      p?.confidence ?? "",
      p?.risk ?? "",
      completeness,
    ];
  });

  const csv = toCsv(headers, rows);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wk-predictions-${date}.csv"`,
    },
  });
}
