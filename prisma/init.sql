-- WK Pool Predictor — one-shot database setup.
-- Paste this whole file into your database's SQL editor (e.g. Neon) and run it.
-- It creates the tables and loads 31 teams + 14 example matches.
-- Afterwards, open the app and click "Regenerate all predictions" on the dashboard.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "confederation" TEXT,
    "fifaRank" INTEGER,
    "fifaPoints" DOUBLE PRECISION,
    "fifaSourceUrl" TEXT,
    "fifaUpdated" TEXT,
    "formMatches" INTEGER,
    "formWins" INTEGER,
    "formDraws" INTEGER,
    "formLosses" INTEGER,
    "formGoalsFor" INTEGER,
    "formGoalsAgainst" INTEGER,
    "formOpponentNote" TEXT,
    "recentFormScore" DOUBLE PRECISION,
    "wcAppearances" INTEGER,
    "wcBestResult" TEXT,
    "wcRecentPerformance" TEXT,
    "knockoutExperienceNote" TEXT,
    "wcHistoryNote" TEXT,
    "worldCupExperienceScore" DOUBLE PRECISION,
    "attackStrength" DOUBLE PRECISION,
    "defenceStrength" DOUBLE PRECISION,
    "goalkeepingNote" TEXT,
    "squadQualityNote" TEXT,
    "injuriesNote" TEXT,
    "manualAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataSource" TEXT,
    "lastUpdated" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "stage" TEXT,
    "groupMatchNumber" INTEGER,
    "kickoff" TEXT,
    "venue" TEXT,
    "homeAdvantage" BOOLEAN NOT NULL DEFAULT false,
    "motivationNote" TEXT,
    "contextNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "pHome" DOUBLE PRECISION NOT NULL,
    "pDraw" DOUBLE PRECISION NOT NULL,
    "pAway" DOUBLE PRECISION NOT NULL,
    "xgHome" DOUBLE PRECISION NOT NULL,
    "xgAway" DOUBLE PRECISION NOT NULL,
    "recommendedScore" TEXT NOT NULL,
    "safeScore" TEXT NOT NULL,
    "aggressiveScore" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "factorsJson" TEXT NOT NULL,
    "dataQualityJson" TEXT NOT NULL,
    "explanationQualityJson" TEXT,
    "manualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideScore" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'balanced',
    "wFifa" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "wForm" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "wAttack" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "wDefence" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "wWcHistory" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "wHomeAdvantage" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "wManual" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "exactScorePoints" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "correctOutcomePoints" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "correctGoalDiffPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_matchId_key" ON "Prediction"("matchId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- WK Pool Predictor — seed data (teams, matches, settings).
-- Generated from prisma/seed.ts; do not edit by hand.

INSERT INTO "Settings" ("id","mode","wFifa","wForm","wAttack","wDefence","wWcHistory","wHomeAdvantage","wManual","exactScorePoints","correctOutcomePoints","correctGoalDiffPoints","updatedAt")
VALUES (1, 'balanced', 0.25, 0.25, 0.20, 0.15, 0.10, 0.03, 0.02, 8, 4, 0, now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Team" ("id","name","code","confederation","fifaRank","fifaPoints","fifaSourceUrl","fifaUpdated","formMatches","formWins","formDraws","formLosses","formGoalsFor","formGoalsAgainst","formOpponentNote","recentFormScore","wcAppearances","wcBestResult","wcRecentPerformance","knockoutExperienceNote","wcHistoryNote","worldCupExperienceScore","attackStrength","defenceStrength","goalkeepingNote","squadQualityNote","injuriesNote","manualAdjustment","dataSource","lastUpdated","createdAt","updatedAt") VALUES
(1, $q$France$q$, $q$FRA$q$, $q$UEFA$q$, 1, 1877.32, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 7, 2, 1, 21, 8, $q$Mixed opposition over last 10 internationals$q$, 86, 16, $q$Winners (1998, 2018)$q$, $q$Runners-up 2022, winners 2018$q$, $q$Elite knockout pedigree$q$, $q$16 appearances; Winners (1998, 2018).$q$, 93, 90, 84, $q$World-class keeper and defensive depth$q$, $q$Deep, elite squad across all lines$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(2, $q$Spain$q$, $q$ESP$q$, $q$UEFA$q$, 2, 1876.4, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 8, 1, 1, 24, 7, $q$Mixed opposition over last 10 internationals$q$, 88, 16, $q$Winners (2010)$q$, $q$Last 16 in 2022$q$, $q$Strong but recent KO exits on penalties$q$, $q$16 appearances; Winners (2010).$q$, 85, 88, 83, $q$Reliable, possession-based defending$q$, $q$Euro 2024 champions, vibrant young core$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(3, $q$Argentina$q$, $q$ARG$q$, $q$CONMEBOL$q$, 3, 1874.81, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 8, 1, 1, 22, 6, $q$Mixed opposition over last 10 internationals$q$, 87, 18, $q$Winners (1978, 1986, 2022)$q$, $q$Champions 2022$q$, $q$Reigning champions, ice-cold in knockouts$q$, $q$18 appearances; Winners (1978, 1986, 2022).$q$, 95, 89, 82, $q$Penalty-specialist keeper$q$, $q$Champions core around Messi-era spine$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(4, $q$England$q$, $q$ENG$q$, $q$UEFA$q$, 4, 1820, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 7, 2, 1, 20, 7, $q$Mixed opposition over last 10 internationals$q$, 82, 16, $q$Winners (1966)$q$, $q$Quarter-finals 2022$q$, $q$Consistent deep runs, no recent trophy$q$, $q$16 appearances; Winners (1966).$q$, 84, 85, 82, $q$Solid keeper, well-drilled back line$q$, $q$Abundant attacking talent$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(5, $q$Portugal$q$, $q$POR$q$, $q$UEFA$q$, 5, 1778, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 7, 1, 2, 19, 9, $q$Mixed opposition over last 10 internationals$q$, 80, 8, $q$Third (1966)$q$, $q$Quarter-finals 2022$q$, $q$Talented but inconsistent in knockouts$q$, $q$8 appearances; Third (1966).$q$, 78, 86, 79, $q$Dependable keeper$q$, $q$Golden generation of attackers$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(6, $q$Brazil$q$, $q$BRA$q$, $q$CONMEBOL$q$, 6, 1760, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 2, 2, 18, 10, $q$Mixed opposition over last 10 internationals$q$, 76, 22, $q$Winners (5 times)$q$, $q$Quarter-finals 2022$q$, $q$Most pedigree of all, recent KO heartbreaks$q$, $q$22 appearances; Winners (5 times).$q$, 90, 87, 80, $q$Strong keeping options$q$, $q$Elite attack, rebuilding spine$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(7, $q$Netherlands$q$, $q$NED$q$, $q$UEFA$q$, 7, 1756, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 3, 1, 17, 9, $q$Mixed opposition over last 10 internationals$q$, 78, 11, $q$Runners-up (1974, 1978, 2010)$q$, $q$Quarter-finals 2022$q$, $q$Organised, dangerous on the counter$q$, $q$11 appearances; Runners-up (1974, 1978, 2010).$q$, 82, 83, 82, $q$Solid keeper, structured defence$q$, $q$Balanced, tournament-tough squad$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(8, $q$Belgium$q$, $q$BEL$q$, $q$UEFA$q$, 8, 1740, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 2, 2, 18, 11, $q$Mixed opposition over last 10 internationals$q$, 73, 14, $q$Third (2018)$q$, $q$Group stage 2022$q$, $q$Golden generation fading, transition$q$, $q$14 appearances; Third (2018).$q$, 74, 82, 76, $q$Experienced keeper$q$, $q$Mix of veterans and emerging talent$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(9, $q$Italy$q$, $q$ITA$q$, $q$UEFA$q$, 9, 1718, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 2, 2, 15, 9, $q$Mixed opposition over last 10 internationals$q$, 72, 18, $q$Winners (4 times)$q$, $q$Did not qualify 2018 & 2022$q$, $q$Great history, recent WC absences$q$, $q$18 appearances; Winners (4 times).$q$, 75, 78, 85, $q$Traditionally elite defensively$q$, $q$Defensively sound, light up front$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(10, $q$Germany$q$, $q$GER$q$, $q$UEFA$q$, 10, 1716, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 2, 2, 19, 12, $q$Mixed opposition over last 10 internationals$q$, 74, 20, $q$Winners (4 times)$q$, $q$Group stage 2018 & 2022$q$, $q$Huge pedigree, recent group exits$q$, $q$20 appearances; Winners (4 times).$q$, 83, 84, 78, $q$Strong goalkeeping tradition$q$, $q$Rebuilt, talented young core$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(11, $q$Croatia$q$, $q$CRO$q$, $q$UEFA$q$, 11, 1710, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 3, 2, 14, 10, $q$Mixed opposition over last 10 internationals$q$, 70, 6, $q$Runners-up (2018)$q$, $q$Third 2022$q$, $q$Masters of tight knockout games$q$, $q$6 appearances; Runners-up (2018).$q$, 80, 78, 79, $q$Reliable keeper$q$, $q$Elite midfield, ageing spine$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(12, $q$Morocco$q$, $q$MAR$q$, $q$CAF$q$, 12, 1706, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 3, 1, 15, 6, $q$Mixed opposition over last 10 internationals$q$, 78, 6, $q$Fourth (2022)$q$, $q$Semi-finals 2022$q$, $q$Brilliant 2022 run, very organised$q$, $q$6 appearances; Fourth (2022).$q$, 72, 77, 83, $q$Excellent keeper and back line$q$, $q$Disciplined, counter-attacking unit$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(13, $q$Colombia$q$, $q$COL$q$, $q$CONMEBOL$q$, 13, 1700, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 3, 1, 16, 8, $q$Mixed opposition over last 10 internationals$q$, 77, 6, $q$Quarter-finals (2014)$q$, $q$Did not qualify 2022$q$, $q$Dangerous, flair-driven side$q$, $q$6 appearances; Quarter-finals (2014).$q$, 68, 81, 76, $q$Solid keeper$q$, $q$Creative attack, improving form$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(14, $q$Uruguay$q$, $q$URU$q$, $q$CONMEBOL$q$, 14, 1678, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 3, 2, 14, 9, $q$Mixed opposition over last 10 internationals$q$, 72, 14, $q$Winners (1930, 1950)$q$, $q$Group stage 2022$q$, $q$Gritty, experienced tournament team$q$, $q$14 appearances; Winners (1930, 1950).$q$, 79, 80, 78, $q$Reliable keeper$q$, $q$Young attack under a sharp coach$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(15, $q$Mexico$q$, $q$MEX$q$, $q$CONCACAF$q$, 15, 1665, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 3, 2, 15, 11, $q$Mixed opposition over last 10 internationals$q$, 68, 17, $q$Quarter-finals (1970, 1986)$q$, $q$Group stage 2022$q$, $q$Regular qualifiers, R16 ceiling$q$, $q$17 appearances; Quarter-finals (1970, 1986).$q$, 73, 76, 74, $q$Experienced keeper$q$, $q$Co-hosts; solid CONCACAF core$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(16, $q$USA$q$, $q$USA$q$, $q$CONCACAF$q$, 16, 1660, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 2, 2, 16, 9, $q$Mixed opposition over last 10 internationals$q$, 71, 11, $q$Third (1930)$q$, $q$Last 16 in 2022$q$, $q$Young, improving, home advantage$q$, $q$11 appearances; Third (1930).$q$, 66, 77, 75, $q$Good young keeper$q$, $q$Co-hosts; European-based core$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(17, $q$Switzerland$q$, $q$SUI$q$, $q$UEFA$q$, 17, 1648, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 3, 2, 13, 9, $q$Mixed opposition over last 10 internationals$q$, 69, 12, $q$Quarter-finals (1934, 1938, 1954)$q$, $q$Last 16 in 2022$q$, $q$Reliable qualifiers, hard to beat$q$, $q$12 appearances; Quarter-finals (1934, 1938, 1954).$q$, 70, 74, 78, $q$Experienced keeper$q$, $q$Well-organised, low-error team$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(18, $q$Senegal$q$, $q$SEN$q$, $q$CAF$q$, 18, 1645, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 2, 2, 15, 8, $q$Mixed opposition over last 10 internationals$q$, 72, 4, $q$Quarter-finals (2002)$q$, $q$Last 16 in 2022$q$, $q$Athletic, rising African power$q$, $q$4 appearances; Quarter-finals (2002).$q$, 64, 78, 77, $q$Strong keeper$q$, $q$Powerful, well-coached squad$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(19, $q$Japan$q$, $q$JPN$q$, $q$AFC$q$, 19, 1640, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 7, 1, 2, 18, 8, $q$Mixed opposition over last 10 internationals$q$, 76, 7, $q$Last 16 (2002, 2010, 2018, 2022)$q$, $q$Last 16 in 2022 (beat Germany & Spain)$q$, $q$Quick, fearless, well-drilled$q$, $q$7 appearances; Last 16 (2002, 2010, 2018, 2022).$q$, 67, 78, 76, $q$Solid keeper$q$, $q$Many Europe-based players, great cohesion$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(20, $q$Denmark$q$, $q$DEN$q$, $q$UEFA$q$, 20, 1630, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 3, 2, 14, 10, $q$Mixed opposition over last 10 internationals$q$, 68, 6, $q$Quarter-finals (1998)$q$, $q$Group stage 2022$q$, $q$Organised, streaky$q$, $q$6 appearances; Quarter-finals (1998).$q$, 65, 75, 77, $q$Reliable keeper$q$, $q$Balanced, experienced spine$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(21, $q$Iran$q$, $q$IRN$q$, $q$AFC$q$, 21, 1610, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 2, 2, 15, 9, $q$Mixed opposition over last 10 internationals$q$, 67, 6, $q$Group stage (best)$q$, $q$Group stage 2022$q$, $q$Strong in Asia, no KO breakthrough$q$, $q$6 appearances; Group stage (best).$q$, 58, 72, 75, $q$Solid keeper$q$, $q$Physical, disciplined unit$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(22, $q$Korea Republic$q$, $q$KOR$q$, $q$AFC$q$, 22, 1590, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 2, 2, 16, 10, $q$Mixed opposition over last 10 internationals$q$, 69, 11, $q$Fourth (2002)$q$, $q$Last 16 in 2022$q$, $q$Energetic, star-led attack$q$, $q$11 appearances; Fourth (2002).$q$, 66, 76, 72, $q$Decent keeper$q$, $q$World-class forward, willing runners$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(23, $q$Ecuador$q$, $q$ECU$q$, $q$CONMEBOL$q$, 23, 1585, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 3, 2, 12, 8, $q$Mixed opposition over last 10 internationals$q$, 67, 4, $q$Last 16 (2006)$q$, $q$Group stage 2022$q$, $q$Young, athletic, improving$q$, $q$4 appearances; Last 16 (2006).$q$, 60, 73, 76, $q$Solid keeper$q$, $q$Strong defence, raw attack$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(24, $q$Austria$q$, $q$AUT$q$, $q$UEFA$q$, 24, 1580, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 2, 2, 17, 11, $q$Mixed opposition over last 10 internationals$q$, 70, 7, $q$Third (1954)$q$, $q$Did not qualify 2022$q$, $q$High-press, well-coached$q$, $q$7 appearances; Third (1954).$q$, 58, 76, 73, $q$Reliable keeper$q$, $q$Intense pressing side$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(25, $q$Australia$q$, $q$AUS$q$, $q$AFC$q$, 25, 1560, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 3, 2, 12, 9, $q$Mixed opposition over last 10 internationals$q$, 65, 6, $q$Last 16 (2006, 2022)$q$, $q$Last 16 in 2022$q$, $q$Spirited, hard-working$q$, $q$6 appearances; Last 16 (2006, 2022).$q$, 60, 70, 74, $q$Experienced keeper$q$, $q$Organised, limited star power$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(26, $q$Ukraine$q$, $q$UKR$q$, $q$UEFA$q$, 26, 1555, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 3, 2, 13, 10, $q$Mixed opposition over last 10 internationals$q$, 66, 1, $q$Quarter-finals (2006)$q$, $q$Did not qualify 2022$q$, $q$Technical, resilient$q$, $q$1 appearances; Quarter-finals (2006).$q$, 55, 74, 73, $q$Good keeper$q$, $q$Talented attackers in Europe$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(27, $q$Poland$q$, $q$POL$q$, $q$UEFA$q$, 27, 1548, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 2, 3, 13, 11, $q$Mixed opposition over last 10 internationals$q$, 62, 9, $q$Third (1974, 1982)$q$, $q$Last 16 in 2022$q$, $q$Reliant on star striker$q$, $q$9 appearances; Third (1974, 1982).$q$, 62, 73, 72, $q$Strong keeper$q$, $q$Elite striker, modest support$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(28, $q$Nigeria$q$, $q$NGA$q$, $q$CAF$q$, 28, 1545, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 3, 2, 14, 10, $q$Mixed opposition over last 10 internationals$q$, 66, 6, $q$Last 16 (1994, 1998, 2014)$q$, $q$Did not qualify 2022$q$, $q$Pacey, inconsistent$q$, $q$6 appearances; Last 16 (1994, 1998, 2014).$q$, 60, 77, 71, $q$Variable keeping$q$, $q$Dynamic forwards, leaky at times$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(29, $q$Canada$q$, $q$CAN$q$, $q$CONCACAF$q$, 29, 1540, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 3, 2, 13, 10, $q$Mixed opposition over last 10 internationals$q$, 65, 2, $q$Group stage (best)$q$, $q$Group stage 2022$q$, $q$Improving, home advantage$q$, $q$2 appearances; Group stage (best).$q$, 52, 74, 71, $q$Decent keeper$q$, $q$Co-hosts; athletic, young core$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(30, $q$Egypt$q$, $q$EGY$q$, $q$CAF$q$, 30, 1535, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 5, 3, 2, 12, 9, $q$Mixed opposition over last 10 internationals$q$, 64, 3, $q$Group stage (best)$q$, $q$Did not qualify 2022$q$, $q$Star-led, otherwise modest$q$, $q$3 appearances; Group stage (best).$q$, 53, 74, 72, $q$Reliable keeper$q$, $q$World-class forward leads the line$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now()),
(31, $q$Norway$q$, $q$NOR$q$, $q$UEFA$q$, 31, 1525, $q$https://inside.fifa.com/fifa-world-ranking/men$q$, $q$2026-04-01$q$, 10, 6, 2, 2, 18, 10, $q$Mixed opposition over last 10 internationals$q$, 70, 3, $q$Last 16 (1998)$q$, $q$Long absence from finals$q$, $q$Star-powered, unproven at WC$q$, $q$3 appearances; Last 16 (1998).$q$, 48, 80, 70, $q$Decent keeper$q$, $q$Generational striker and playmaker$q$, '', 0, $q$FIFA April 2026 snapshot; form & strength estimated from public results.$q$, $q$2026-04-01$q$, now(), now())
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Match" ("id","homeTeamId","awayTeamId","stage","groupMatchNumber","venue","homeAdvantage","motivationNote","createdAt") VALUES
(1, 15, 11, $q$Group A$q$, 1, $q$Mexico City$q$, TRUE, $q$Co-hosts open the tournament$q$, now()),
(2, 2, 19, $q$Group B$q$, 1, $q$Los Angeles$q$, FALSE, NULL, now()),
(3, 16, 18, $q$Group C$q$, 1, $q$New York$q$, TRUE, NULL, now()),
(4, 3, 31, $q$Group D$q$, 1, $q$Dallas$q$, FALSE, NULL, now()),
(5, 1, 15, $q$Group A$q$, 2, $q$Guadalajara$q$, FALSE, NULL, now()),
(6, 4, 12, $q$Group E$q$, 1, $q$Toronto$q$, FALSE, NULL, now()),
(7, 6, 17, $q$Group F$q$, 1, $q$Miami$q$, FALSE, NULL, now()),
(8, 7, 23, $q$Group G$q$, 1, $q$Houston$q$, FALSE, NULL, now()),
(9, 5, 14, $q$Group H$q$, 2, $q$Atlanta$q$, FALSE, NULL, now()),
(10, 10, 22, $q$Group I$q$, 1, $q$Philadelphia$q$, FALSE, NULL, now()),
(11, 29, 8, $q$Group J$q$, 1, $q$Vancouver$q$, TRUE, NULL, now()),
(12, 9, 28, $q$Group K$q$, 1, $q$Seattle$q$, FALSE, NULL, now()),
(13, 3, 2, $q$Round of 16$q$, NULL, $q$New York$q$, FALSE, $q$Marquee knockout tie$q$, now()),
(14, 1, 6, $q$Quarter-final$q$, NULL, $q$Dallas$q$, FALSE, $q$Heavyweight clash$q$, now());

SELECT setval(pg_get_serial_sequence('"Team"','id'), (SELECT MAX(id) FROM "Team"));
SELECT setval(pg_get_serial_sequence('"Match"','id'), (SELECT MAX(id) FROM "Match"));
