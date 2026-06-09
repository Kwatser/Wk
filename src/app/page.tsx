import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { regenerateAll } from "./actions";
import { ConfidenceBadge, PageHeader, RiskBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [matches, teamCount] = await Promise.all([
    prisma.match.findMany({
      include: { homeTeam: true, awayTeam: true, prediction: true },
      orderBy: [{ kickoff: "asc" }, { id: "asc" }],
    }),
    prisma.team.count(),
  ]);

  const withPrediction = matches.filter((m) => m.prediction);
  const completeness = matches.length ? Math.round((withPrediction.length / matches.length) * 100) : 0;
  const highRisk = withPrediction.filter((m) => m.prediction!.risk === "High");
  const lowDataQuality = withPrediction.filter((m) => {
    try {
      return (JSON.parse(m.prediction!.dataQualityJson).completeness ?? 1) < 1;
    } catch {
      return false;
    }
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your World Cup pool predictions."
        action={
          <form action={regenerateAll}>
            <button className="btn" type="submit">
              ↻ Regenerate all predictions
            </button>
          </form>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Teams" value={teamCount} href="/teams" />
        <Stat label="Matches" value={matches.length} href="/matches" />
        <Stat label="Predictions complete" value={`${completeness}%`} />
        <Stat label="High-risk matches" value={highRisk.length} accent={highRisk.length > 0} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Upcoming matches</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-slate-500">
            No matches yet. <Link href="/matches" className="text-brand hover:underline">Add one →</Link>
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {matches.slice(0, 8).map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="card flex items-center justify-between transition hover:border-brand"
              >
                <div>
                  <div className="text-xs text-slate-400">{m.stage ?? "Match"}</div>
                  <div className="font-medium">
                    {m.homeTeam.name} <span className="text-slate-400">vs</span> {m.awayTeam.name}
                  </div>
                  {m.prediction ? (
                    <div className="mt-1 text-sm text-slate-600">
                      Pick: <span className="font-semibold text-brand">
                        {m.prediction.manualOverride && m.prediction.overrideScore
                          ? m.prediction.overrideScore
                          : m.prediction.recommendedScore}
                      </span>
                      {m.prediction.manualOverride && (
                        <span className="ml-1 text-xs text-slate-400">(override)</span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-amber-600">No prediction yet</div>
                  )}
                </div>
                {m.prediction && (
                  <div className="flex flex-col items-end gap-1">
                    <ConfidenceBadge value={m.prediction.confidence} />
                    <RiskBadge value={m.prediction.risk} />
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {highRisk.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">⚠ High-risk matches</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {highRisk.map((m) => (
              <Link
                key={m.id}
                href={`/matches/${m.id}`}
                className="flex items-center justify-between rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm hover:border-rose-400"
              >
                <span>
                  {m.homeTeam.name} vs {m.awayTeam.name}
                </span>
                <span className="font-semibold text-brand">{m.prediction!.recommendedScore}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {lowDataQuality.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Incomplete data</h2>
          <p className="text-sm text-slate-500">
            {lowDataQuality.length} match{lowDataQuality.length > 1 ? "es have" : " has"} missing inputs
            that reduce prediction reliability. Fill in the team data for sharper advice.
          </p>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div className={`card ${accent ? "border-rose-300" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${accent ? "text-rose-600" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
