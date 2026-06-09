import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clearOverride, regeneratePrediction, setOverride } from "@/app/actions";
import {
  BackLink,
  ConfidenceBadge,
  DataWarning,
  PageHeader,
  ProbBar,
  RiskBadge,
  ScoreChip,
} from "@/components/ui";
import { Explanation } from "@/components/explanation";
import type { DataQuality, ExplanationQuality, FactorBreakdown } from "@/lib/types";

const DEFAULT_EQ: ExplanationQuality = { dataPoints: 0, ok: true, missingData: [], warnings: [] };

export const dynamic = "force-dynamic";

export default async function MatchAdvicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matchId = Number(id);
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true, prediction: true },
  });
  if (!match) notFound();

  const p = match.prediction;
  const regenerate = regeneratePrediction.bind(null, matchId);
  const override = setOverride.bind(null, matchId);
  const clear = clearOverride.bind(null, matchId);

  const factors: FactorBreakdown[] = p ? safeParse(p.factorsJson, []) : [];
  const dq: DataQuality = p ? safeParse(p.dataQualityJson, { completeness: 1, warnings: [] }) : { completeness: 1, warnings: [] };
  const eq: ExplanationQuality = p ? safeParse(p.explanationQualityJson ?? "", DEFAULT_EQ) : DEFAULT_EQ;

  const finalPick = p?.manualOverride && p.overrideScore ? p.overrideScore : p?.recommendedScore;

  return (
    <div>
      <BackLink href="/matches">Back to matches</BackLink>
      <PageHeader
        title={`${match.homeTeam.name} vs ${match.awayTeam.name}`}
        subtitle={[match.stage, match.venue, match.kickoff].filter(Boolean).join(" · ") || undefined}
        action={
          <div className="flex gap-2">
            <Link href={`/matches/${matchId}/edit`} className="btn-secondary">
              Edit match
            </Link>
            <form action={regenerate}>
              <button className="btn" type="submit">
                ↻ Regenerate
              </button>
            </form>
          </div>
        }
      />

      {!p ? (
        <div className="card">
          <p className="text-sm text-slate-600">No prediction yet.</p>
          <form action={regenerate} className="mt-3">
            <button className="btn" type="submit">
              Generate prediction
            </button>
          </form>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Left: scores + probabilities + override */}
          <div className="space-y-5 lg:col-span-1">
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Your pick ({p.mode} mode)
                </h2>
                <div className="text-3xl font-extrabold text-brand">{finalPick}</div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ScoreChip label="Recommended" score={p.recommendedScore} accent />
                <ScoreChip label="Safe" score={p.safeScore} />
                <ScoreChip label="Aggressive" score={p.aggressiveScore} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ConfidenceBadge value={p.confidence} />
                <RiskBadge value={p.risk} />
              </div>
            </div>

            <div className="card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Outcome probabilities
              </h2>
              <ProbBar
                pHome={p.pHome}
                pDraw={p.pDraw}
                pAway={p.pAway}
                home={match.homeTeam.name}
                away={match.awayTeam.name}
              />
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-slate-50 p-2 text-center">
                  <div className="text-xs text-slate-500">xG {match.homeTeam.name}</div>
                  <div className="text-xl font-bold">{p.xgHome.toFixed(2)}</div>
                </div>
                <div className="rounded-md bg-slate-50 p-2 text-center">
                  <div className="text-xs text-slate-500">xG {match.awayTeam.name}</div>
                  <div className="text-xl font-bold">{p.xgAway.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Manual override — every prediction can be overridden. */}
            <div className="card">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Manual override
              </h2>
              <form action={override} className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="label" htmlFor="overrideScore">
                    Your own score (e.g. 2-1)
                  </label>
                  <input
                    id="overrideScore"
                    name="overrideScore"
                    defaultValue={p.overrideScore ?? ""}
                    placeholder="e.g. 2-1"
                    pattern="\d+-\d+"
                    className="input"
                  />
                </div>
                <button type="submit" className="btn">
                  Save
                </button>
              </form>
              {p.manualOverride && (
                <form action={clear} className="mt-2">
                  <button type="submit" className="btn-ghost">
                    Clear override (use model pick)
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right: explanation + factors + data quality */}
          <div className="space-y-5 lg:col-span-2">
            {dq.warnings.length > 0 && <DataWarning warnings={dq.warnings} />}

            <div className="card">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-800">Why this advice</h2>
                <span
                  className={`badge ${eq.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                  title="Number of concrete input values cited in the explanation"
                >
                  {eq.dataPoints} data point{eq.dataPoints === 1 ? "" : "s"} cited
                </span>
              </div>
              {!eq.ok && (
                <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  <div className="font-semibold">⚠ Thin explanation</div>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {eq.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Explanation text={p.explanation} />
            </div>

            <div className="card">
              <h2 className="mb-3 text-lg font-semibold text-slate-800">Input factor breakdown</h2>
              <p className="mb-3 text-xs text-slate-400">
                Contribution = (home value − away value) × weight, in rating points. Positive favours{" "}
                {match.homeTeam.name}; negative favours {match.awayTeam.name}.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr>
                      <th className="th">Factor</th>
                      <th className="th">Weight</th>
                      <th className="th">{match.homeTeam.name}</th>
                      <th className="th">{match.awayTeam.name}</th>
                      <th className="th">Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {factors.map((f) => (
                      <tr key={f.label}>
                        <td className="td font-medium">{f.label}</td>
                        <td className="td text-slate-500">{f.weightPct}%</td>
                        <td className="td">{fmtVal(f.homeValue)}</td>
                        <td className="td">{fmtVal(f.awayValue)}</td>
                        <td className={`td font-medium ${f.contribution >= 0 ? "text-brand" : "text-rose-600"}`}>
                          {f.contribution >= 0 ? "+" : ""}
                          {f.contribution.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Data completeness: {Math.round(dq.completeness * 100)}%. The model is rule-based and
                uncertain — use these numbers as guidance, not gospel.
              </p>
            </div>

            <div className="flex gap-3 text-sm">
              <Link href={`/teams/${match.homeTeamId}`} className="text-brand hover:underline">
                View {match.homeTeam.name} data →
              </Link>
              <Link href={`/teams/${match.awayTeamId}`} className="text-brand hover:underline">
                View {match.awayTeam.name} data →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmtVal(v: number | null): string {
  return v == null ? "—" : Math.round(v).toString();
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
