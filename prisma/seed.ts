// Seed data for WK Pool Predictor.
//
// Values are a researched snapshot of public information for the 2026 cycle:
//  - FIFA points/rank: FIFA/Coca-Cola Men's World Ranking, April 2026 edition
//    (anchored on the published top of the table; see README "Data & sourcing").
//  - Recent form, attack/defence and World Cup-history scores are analyst-style
//    estimates derived from public results and reputation as of the snapshot date.
// Everything here is fully editable in the app — treat it as a starting point.

import { PrismaClient } from "@prisma/client";
import { predictMatch } from "../src/lib/model";
import {
  DEFAULT_SCORING,
  DEFAULT_WEIGHTS,
  settingsToScoring,
  settingsToWeights,
} from "../src/lib/defaults";

const prisma = new PrismaClient();

const FIFA_SOURCE = "https://inside.fifa.com/fifa-world-ranking/men";
const FIFA_DATE = "2026-04-01";
const SNAPSHOT_NOTE = "FIFA April 2026 snapshot; form & strength estimated from public results.";

interface SeedTeam {
  name: string;
  code: string;
  confederation: string;
  fifaRank: number;
  fifaPoints: number;
  form: [w: number, d: number, l: number, gf: number, ga: number]; // last 10
  recentFormScore: number;
  wcAppearances: number;
  wcBestResult: string;
  wcRecentPerformance: string;
  knockoutExperienceNote: string;
  worldCupExperienceScore: number;
  attackStrength: number;
  defenceStrength: number;
  goalkeepingNote: string;
  squadQualityNote: string;
}

const TEAMS: SeedTeam[] = [
  {
    name: "France", code: "FRA", confederation: "UEFA", fifaRank: 1, fifaPoints: 1877.32,
    form: [7, 2, 1, 21, 8], recentFormScore: 86, wcAppearances: 16, wcBestResult: "Winners (1998, 2018)",
    wcRecentPerformance: "Runners-up 2022, winners 2018", knockoutExperienceNote: "Elite knockout pedigree",
    worldCupExperienceScore: 93, attackStrength: 90, defenceStrength: 84,
    goalkeepingNote: "World-class keeper and defensive depth", squadQualityNote: "Deep, elite squad across all lines",
  },
  {
    name: "Spain", code: "ESP", confederation: "UEFA", fifaRank: 2, fifaPoints: 1876.40,
    form: [8, 1, 1, 24, 7], recentFormScore: 88, wcAppearances: 16, wcBestResult: "Winners (2010)",
    wcRecentPerformance: "Last 16 in 2022", knockoutExperienceNote: "Strong but recent KO exits on penalties",
    worldCupExperienceScore: 85, attackStrength: 88, defenceStrength: 83,
    goalkeepingNote: "Reliable, possession-based defending", squadQualityNote: "Euro 2024 champions, vibrant young core",
  },
  {
    name: "Argentina", code: "ARG", confederation: "CONMEBOL", fifaRank: 3, fifaPoints: 1874.81,
    form: [8, 1, 1, 22, 6], recentFormScore: 87, wcAppearances: 18, wcBestResult: "Winners (1978, 1986, 2022)",
    wcRecentPerformance: "Champions 2022", knockoutExperienceNote: "Reigning champions, ice-cold in knockouts",
    worldCupExperienceScore: 95, attackStrength: 89, defenceStrength: 82,
    goalkeepingNote: "Penalty-specialist keeper", squadQualityNote: "Champions core around Messi-era spine",
  },
  {
    name: "England", code: "ENG", confederation: "UEFA", fifaRank: 4, fifaPoints: 1820.0,
    form: [7, 2, 1, 20, 7], recentFormScore: 82, wcAppearances: 16, wcBestResult: "Winners (1966)",
    wcRecentPerformance: "Quarter-finals 2022", knockoutExperienceNote: "Consistent deep runs, no recent trophy",
    worldCupExperienceScore: 84, attackStrength: 85, defenceStrength: 82,
    goalkeepingNote: "Solid keeper, well-drilled back line", squadQualityNote: "Abundant attacking talent",
  },
  {
    name: "Portugal", code: "POR", confederation: "UEFA", fifaRank: 5, fifaPoints: 1778.0,
    form: [7, 1, 2, 19, 9], recentFormScore: 80, wcAppearances: 8, wcBestResult: "Third (1966)",
    wcRecentPerformance: "Quarter-finals 2022", knockoutExperienceNote: "Talented but inconsistent in knockouts",
    worldCupExperienceScore: 78, attackStrength: 86, defenceStrength: 79,
    goalkeepingNote: "Dependable keeper", squadQualityNote: "Golden generation of attackers",
  },
  {
    name: "Brazil", code: "BRA", confederation: "CONMEBOL", fifaRank: 6, fifaPoints: 1760.0,
    form: [6, 2, 2, 18, 10], recentFormScore: 76, wcAppearances: 22, wcBestResult: "Winners (5 times)",
    wcRecentPerformance: "Quarter-finals 2022", knockoutExperienceNote: "Most pedigree of all, recent KO heartbreaks",
    worldCupExperienceScore: 90, attackStrength: 87, defenceStrength: 80,
    goalkeepingNote: "Strong keeping options", squadQualityNote: "Elite attack, rebuilding spine",
  },
  {
    name: "Netherlands", code: "NED", confederation: "UEFA", fifaRank: 7, fifaPoints: 1756.0,
    form: [6, 3, 1, 17, 9], recentFormScore: 78, wcAppearances: 11, wcBestResult: "Runners-up (1974, 1978, 2010)",
    wcRecentPerformance: "Quarter-finals 2022", knockoutExperienceNote: "Organised, dangerous on the counter",
    worldCupExperienceScore: 82, attackStrength: 83, defenceStrength: 82,
    goalkeepingNote: "Solid keeper, structured defence", squadQualityNote: "Balanced, tournament-tough squad",
  },
  {
    name: "Belgium", code: "BEL", confederation: "UEFA", fifaRank: 8, fifaPoints: 1740.0,
    form: [6, 2, 2, 18, 11], recentFormScore: 73, wcAppearances: 14, wcBestResult: "Third (2018)",
    wcRecentPerformance: "Group stage 2022", knockoutExperienceNote: "Golden generation fading, transition",
    worldCupExperienceScore: 74, attackStrength: 82, defenceStrength: 76,
    goalkeepingNote: "Experienced keeper", squadQualityNote: "Mix of veterans and emerging talent",
  },
  {
    name: "Italy", code: "ITA", confederation: "UEFA", fifaRank: 9, fifaPoints: 1718.0,
    form: [6, 2, 2, 15, 9], recentFormScore: 72, wcAppearances: 18, wcBestResult: "Winners (4 times)",
    wcRecentPerformance: "Did not qualify 2018 & 2022", knockoutExperienceNote: "Great history, recent WC absences",
    worldCupExperienceScore: 75, attackStrength: 78, defenceStrength: 85,
    goalkeepingNote: "Traditionally elite defensively", squadQualityNote: "Defensively sound, light up front",
  },
  {
    name: "Germany", code: "GER", confederation: "UEFA", fifaRank: 10, fifaPoints: 1716.0,
    form: [6, 2, 2, 19, 12], recentFormScore: 74, wcAppearances: 20, wcBestResult: "Winners (4 times)",
    wcRecentPerformance: "Group stage 2018 & 2022", knockoutExperienceNote: "Huge pedigree, recent group exits",
    worldCupExperienceScore: 83, attackStrength: 84, defenceStrength: 78,
    goalkeepingNote: "Strong goalkeeping tradition", squadQualityNote: "Rebuilt, talented young core",
  },
  {
    name: "Croatia", code: "CRO", confederation: "UEFA", fifaRank: 11, fifaPoints: 1710.0,
    form: [5, 3, 2, 14, 10], recentFormScore: 70, wcAppearances: 6, wcBestResult: "Runners-up (2018)",
    wcRecentPerformance: "Third 2022", knockoutExperienceNote: "Masters of tight knockout games",
    worldCupExperienceScore: 80, attackStrength: 78, defenceStrength: 79,
    goalkeepingNote: "Reliable keeper", squadQualityNote: "Elite midfield, ageing spine",
  },
  {
    name: "Morocco", code: "MAR", confederation: "CAF", fifaRank: 12, fifaPoints: 1706.0,
    form: [6, 3, 1, 15, 6], recentFormScore: 78, wcAppearances: 6, wcBestResult: "Fourth (2022)",
    wcRecentPerformance: "Semi-finals 2022", knockoutExperienceNote: "Brilliant 2022 run, very organised",
    worldCupExperienceScore: 72, attackStrength: 77, defenceStrength: 83,
    goalkeepingNote: "Excellent keeper and back line", squadQualityNote: "Disciplined, counter-attacking unit",
  },
  {
    name: "Colombia", code: "COL", confederation: "CONMEBOL", fifaRank: 13, fifaPoints: 1700.0,
    form: [6, 3, 1, 16, 8], recentFormScore: 77, wcAppearances: 6, wcBestResult: "Quarter-finals (2014)",
    wcRecentPerformance: "Did not qualify 2022", knockoutExperienceNote: "Dangerous, flair-driven side",
    worldCupExperienceScore: 68, attackStrength: 81, defenceStrength: 76,
    goalkeepingNote: "Solid keeper", squadQualityNote: "Creative attack, improving form",
  },
  {
    name: "Uruguay", code: "URU", confederation: "CONMEBOL", fifaRank: 14, fifaPoints: 1678.0,
    form: [5, 3, 2, 14, 9], recentFormScore: 72, wcAppearances: 14, wcBestResult: "Winners (1930, 1950)",
    wcRecentPerformance: "Group stage 2022", knockoutExperienceNote: "Gritty, experienced tournament team",
    worldCupExperienceScore: 79, attackStrength: 80, defenceStrength: 78,
    goalkeepingNote: "Reliable keeper", squadQualityNote: "Young attack under a sharp coach",
  },
  {
    name: "Mexico", code: "MEX", confederation: "CONCACAF", fifaRank: 15, fifaPoints: 1665.0,
    form: [5, 3, 2, 15, 11], recentFormScore: 68, wcAppearances: 17, wcBestResult: "Quarter-finals (1970, 1986)",
    wcRecentPerformance: "Group stage 2022", knockoutExperienceNote: "Regular qualifiers, R16 ceiling",
    worldCupExperienceScore: 73, attackStrength: 76, defenceStrength: 74,
    goalkeepingNote: "Experienced keeper", squadQualityNote: "Co-hosts; solid CONCACAF core",
  },
  {
    name: "USA", code: "USA", confederation: "CONCACAF", fifaRank: 16, fifaPoints: 1660.0,
    form: [6, 2, 2, 16, 9], recentFormScore: 71, wcAppearances: 11, wcBestResult: "Third (1930)",
    wcRecentPerformance: "Last 16 in 2022", knockoutExperienceNote: "Young, improving, home advantage",
    worldCupExperienceScore: 66, attackStrength: 77, defenceStrength: 75,
    goalkeepingNote: "Good young keeper", squadQualityNote: "Co-hosts; European-based core",
  },
  {
    name: "Switzerland", code: "SUI", confederation: "UEFA", fifaRank: 17, fifaPoints: 1648.0,
    form: [5, 3, 2, 13, 9], recentFormScore: 69, wcAppearances: 12, wcBestResult: "Quarter-finals (1934, 1938, 1954)",
    wcRecentPerformance: "Last 16 in 2022", knockoutExperienceNote: "Reliable qualifiers, hard to beat",
    worldCupExperienceScore: 70, attackStrength: 74, defenceStrength: 78,
    goalkeepingNote: "Experienced keeper", squadQualityNote: "Well-organised, low-error team",
  },
  {
    name: "Senegal", code: "SEN", confederation: "CAF", fifaRank: 18, fifaPoints: 1645.0,
    form: [6, 2, 2, 15, 8], recentFormScore: 72, wcAppearances: 4, wcBestResult: "Quarter-finals (2002)",
    wcRecentPerformance: "Last 16 in 2022", knockoutExperienceNote: "Athletic, rising African power",
    worldCupExperienceScore: 64, attackStrength: 78, defenceStrength: 77,
    goalkeepingNote: "Strong keeper", squadQualityNote: "Powerful, well-coached squad",
  },
  {
    name: "Japan", code: "JPN", confederation: "AFC", fifaRank: 19, fifaPoints: 1640.0,
    form: [7, 1, 2, 18, 8], recentFormScore: 76, wcAppearances: 7, wcBestResult: "Last 16 (2002, 2010, 2018, 2022)",
    wcRecentPerformance: "Last 16 in 2022 (beat Germany & Spain)", knockoutExperienceNote: "Quick, fearless, well-drilled",
    worldCupExperienceScore: 67, attackStrength: 78, defenceStrength: 76,
    goalkeepingNote: "Solid keeper", squadQualityNote: "Many Europe-based players, great cohesion",
  },
  {
    name: "Denmark", code: "DEN", confederation: "UEFA", fifaRank: 20, fifaPoints: 1630.0,
    form: [5, 3, 2, 14, 10], recentFormScore: 68, wcAppearances: 6, wcBestResult: "Quarter-finals (1998)",
    wcRecentPerformance: "Group stage 2022", knockoutExperienceNote: "Organised, streaky",
    worldCupExperienceScore: 65, attackStrength: 75, defenceStrength: 77,
    goalkeepingNote: "Reliable keeper", squadQualityNote: "Balanced, experienced spine",
  },
  {
    name: "Iran", code: "IRN", confederation: "AFC", fifaRank: 21, fifaPoints: 1610.0,
    form: [6, 2, 2, 15, 9], recentFormScore: 67, wcAppearances: 6, wcBestResult: "Group stage (best)",
    wcRecentPerformance: "Group stage 2022", knockoutExperienceNote: "Strong in Asia, no KO breakthrough",
    worldCupExperienceScore: 58, attackStrength: 72, defenceStrength: 75,
    goalkeepingNote: "Solid keeper", squadQualityNote: "Physical, disciplined unit",
  },
  {
    name: "Korea Republic", code: "KOR", confederation: "AFC", fifaRank: 22, fifaPoints: 1590.0,
    form: [6, 2, 2, 16, 10], recentFormScore: 69, wcAppearances: 11, wcBestResult: "Fourth (2002)",
    wcRecentPerformance: "Last 16 in 2022", knockoutExperienceNote: "Energetic, star-led attack",
    worldCupExperienceScore: 66, attackStrength: 76, defenceStrength: 72,
    goalkeepingNote: "Decent keeper", squadQualityNote: "World-class forward, willing runners",
  },
  {
    name: "Ecuador", code: "ECU", confederation: "CONMEBOL", fifaRank: 23, fifaPoints: 1585.0,
    form: [5, 3, 2, 12, 8], recentFormScore: 67, wcAppearances: 4, wcBestResult: "Last 16 (2006)",
    wcRecentPerformance: "Group stage 2022", knockoutExperienceNote: "Young, athletic, improving",
    worldCupExperienceScore: 60, attackStrength: 73, defenceStrength: 76,
    goalkeepingNote: "Solid keeper", squadQualityNote: "Strong defence, raw attack",
  },
  {
    name: "Austria", code: "AUT", confederation: "UEFA", fifaRank: 24, fifaPoints: 1580.0,
    form: [6, 2, 2, 17, 11], recentFormScore: 70, wcAppearances: 7, wcBestResult: "Third (1954)",
    wcRecentPerformance: "Did not qualify 2022", knockoutExperienceNote: "High-press, well-coached",
    worldCupExperienceScore: 58, attackStrength: 76, defenceStrength: 73,
    goalkeepingNote: "Reliable keeper", squadQualityNote: "Intense pressing side",
  },
  {
    name: "Australia", code: "AUS", confederation: "AFC", fifaRank: 25, fifaPoints: 1560.0,
    form: [5, 3, 2, 12, 9], recentFormScore: 65, wcAppearances: 6, wcBestResult: "Last 16 (2006, 2022)",
    wcRecentPerformance: "Last 16 in 2022", knockoutExperienceNote: "Spirited, hard-working",
    worldCupExperienceScore: 60, attackStrength: 70, defenceStrength: 74,
    goalkeepingNote: "Experienced keeper", squadQualityNote: "Organised, limited star power",
  },
  {
    name: "Ukraine", code: "UKR", confederation: "UEFA", fifaRank: 26, fifaPoints: 1555.0,
    form: [5, 3, 2, 13, 10], recentFormScore: 66, wcAppearances: 1, wcBestResult: "Quarter-finals (2006)",
    wcRecentPerformance: "Did not qualify 2022", knockoutExperienceNote: "Technical, resilient",
    worldCupExperienceScore: 55, attackStrength: 74, defenceStrength: 73,
    goalkeepingNote: "Good keeper", squadQualityNote: "Talented attackers in Europe",
  },
  {
    name: "Poland", code: "POL", confederation: "UEFA", fifaRank: 27, fifaPoints: 1548.0,
    form: [5, 2, 3, 13, 11], recentFormScore: 62, wcAppearances: 9, wcBestResult: "Third (1974, 1982)",
    wcRecentPerformance: "Last 16 in 2022", knockoutExperienceNote: "Reliant on star striker",
    worldCupExperienceScore: 62, attackStrength: 73, defenceStrength: 72,
    goalkeepingNote: "Strong keeper", squadQualityNote: "Elite striker, modest support",
  },
  {
    name: "Nigeria", code: "NGA", confederation: "CAF", fifaRank: 28, fifaPoints: 1545.0,
    form: [5, 3, 2, 14, 10], recentFormScore: 66, wcAppearances: 6, wcBestResult: "Last 16 (1994, 1998, 2014)",
    wcRecentPerformance: "Did not qualify 2022", knockoutExperienceNote: "Pacey, inconsistent",
    worldCupExperienceScore: 60, attackStrength: 77, defenceStrength: 71,
    goalkeepingNote: "Variable keeping", squadQualityNote: "Dynamic forwards, leaky at times",
  },
  {
    name: "Canada", code: "CAN", confederation: "CONCACAF", fifaRank: 29, fifaPoints: 1540.0,
    form: [5, 3, 2, 13, 10], recentFormScore: 65, wcAppearances: 2, wcBestResult: "Group stage (best)",
    wcRecentPerformance: "Group stage 2022", knockoutExperienceNote: "Improving, home advantage",
    worldCupExperienceScore: 52, attackStrength: 74, defenceStrength: 71,
    goalkeepingNote: "Decent keeper", squadQualityNote: "Co-hosts; athletic, young core",
  },
  {
    name: "Egypt", code: "EGY", confederation: "CAF", fifaRank: 30, fifaPoints: 1535.0,
    form: [5, 3, 2, 12, 9], recentFormScore: 64, wcAppearances: 3, wcBestResult: "Group stage (best)",
    wcRecentPerformance: "Did not qualify 2022", knockoutExperienceNote: "Star-led, otherwise modest",
    worldCupExperienceScore: 53, attackStrength: 74, defenceStrength: 72,
    goalkeepingNote: "Reliable keeper", squadQualityNote: "World-class forward leads the line",
  },
  {
    name: "Norway", code: "NOR", confederation: "UEFA", fifaRank: 31, fifaPoints: 1525.0,
    form: [6, 2, 2, 18, 10], recentFormScore: 70, wcAppearances: 3, wcBestResult: "Last 16 (1998)",
    wcRecentPerformance: "Long absence from finals", knockoutExperienceNote: "Star-powered, unproven at WC",
    worldCupExperienceScore: 48, attackStrength: 80, defenceStrength: 70,
    goalkeepingNote: "Decent keeper", squadQualityNote: "Generational striker and playmaker",
  },
];

interface SeedMatch {
  home: string;
  away: string;
  stage: string;
  groupMatchNumber?: number;
  venue?: string;
  homeAdvantage?: boolean;
  motivationNote?: string;
}

// Example fixtures (generic 2026 examples, not an official schedule).
const MATCHES: SeedMatch[] = [
  { home: "Mexico", away: "Croatia", stage: "Group A", groupMatchNumber: 1, venue: "Mexico City", homeAdvantage: true, motivationNote: "Co-hosts open the tournament" },
  { home: "Spain", away: "Japan", stage: "Group B", groupMatchNumber: 1, venue: "Los Angeles" },
  { home: "USA", away: "Senegal", stage: "Group C", groupMatchNumber: 1, venue: "New York", homeAdvantage: true },
  { home: "Argentina", away: "Norway", stage: "Group D", groupMatchNumber: 1, venue: "Dallas" },
  { home: "France", away: "Mexico", stage: "Group A", groupMatchNumber: 2, venue: "Guadalajara" },
  { home: "England", away: "Morocco", stage: "Group E", groupMatchNumber: 1, venue: "Toronto" },
  { home: "Brazil", away: "Switzerland", stage: "Group F", groupMatchNumber: 1, venue: "Miami" },
  { home: "Netherlands", away: "Ecuador", stage: "Group G", groupMatchNumber: 1, venue: "Houston" },
  { home: "Portugal", away: "Uruguay", stage: "Group H", groupMatchNumber: 2, venue: "Atlanta" },
  { home: "Germany", away: "Korea Republic", stage: "Group I", groupMatchNumber: 1, venue: "Philadelphia" },
  { home: "Canada", away: "Belgium", stage: "Group J", groupMatchNumber: 1, venue: "Vancouver", homeAdvantage: true },
  { home: "Italy", away: "Nigeria", stage: "Group K", groupMatchNumber: 1, venue: "Seattle" },
  { home: "Argentina", away: "Spain", stage: "Round of 16", venue: "New York", motivationNote: "Marquee knockout tie" },
  { home: "France", away: "Brazil", stage: "Quarter-final", venue: "Dallas", motivationNote: "Heavyweight clash" },
];

async function main() {
  console.log("Seeding WK Pool Predictor...");

  // Settings singleton.
  await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  // Teams.
  for (const t of TEAMS) {
    const [w, d, l, gf, ga] = t.form;
    const payload = {
      code: t.code,
      confederation: t.confederation,
      fifaRank: t.fifaRank,
      fifaPoints: t.fifaPoints,
      fifaSourceUrl: FIFA_SOURCE,
      fifaUpdated: FIFA_DATE,
      formMatches: 10,
      formWins: w,
      formDraws: d,
      formLosses: l,
      formGoalsFor: gf,
      formGoalsAgainst: ga,
      formOpponentNote: "Mixed opposition over last 10 internationals",
      recentFormScore: t.recentFormScore,
      wcAppearances: t.wcAppearances,
      wcBestResult: t.wcBestResult,
      wcRecentPerformance: t.wcRecentPerformance,
      knockoutExperienceNote: t.knockoutExperienceNote,
      wcHistoryNote: `${t.wcAppearances} appearances; ${t.wcBestResult}.`,
      worldCupExperienceScore: t.worldCupExperienceScore,
      attackStrength: t.attackStrength,
      defenceStrength: t.defenceStrength,
      goalkeepingNote: t.goalkeepingNote,
      squadQualityNote: t.squadQualityNote,
      injuriesNote: "",
      manualAdjustment: 0,
      dataSource: SNAPSHOT_NOTE,
      lastUpdated: FIFA_DATE,
    };
    await prisma.team.upsert({
      where: { name: t.name },
      update: payload,
      create: { name: t.name, ...payload },
    });
  }

  // Reset matches (and their predictions via cascade) for a clean reseed.
  await prisma.prediction.deleteMany({});
  await prisma.match.deleteMany({});

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const weights = settings ? settingsToWeights(settings) : DEFAULT_WEIGHTS;
  const scoring = settings ? settingsToScoring(settings) : DEFAULT_SCORING;
  const mode = (settings?.mode ?? "balanced") as "safe" | "balanced" | "aggressive";

  for (const m of MATCHES) {
    const home = await prisma.team.findUnique({ where: { name: m.home } });
    const away = await prisma.team.findUnique({ where: { name: m.away } });
    if (!home || !away) {
      console.warn(`Skipping match ${m.home} v ${m.away}: team missing`);
      continue;
    }
    const match = await prisma.match.create({
      data: {
        homeTeamId: home.id,
        awayTeamId: away.id,
        stage: m.stage,
        groupMatchNumber: m.groupMatchNumber ?? null,
        venue: m.venue ?? null,
        homeAdvantage: m.homeAdvantage ?? false,
        motivationNote: m.motivationNote ?? null,
      },
    });

    // Pre-generate a prediction so the app is immediately useful.
    const result = predictMatch(
      home,
      away,
      { homeAdvantage: match.homeAdvantage },
      weights,
      scoring,
      mode,
    );
    await prisma.prediction.create({
      data: {
        matchId: match.id,
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
      },
    });
  }

  console.log(`Seeded ${TEAMS.length} teams and ${MATCHES.length} matches.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
