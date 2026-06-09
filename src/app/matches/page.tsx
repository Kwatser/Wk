import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { regenerateAll } from "@/app/actions";
import { ConfidenceBadge, PageHeader, RiskBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const matches = await prisma.match.findMany({
    include: { homeTeam: true, awayTeam: true, prediction: true },
    orderBy: [{ kickoff: "asc" }, { id: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Matches"
        subtitle="Generate and review per-match advice."
        action={
          <div className="flex gap-2">
            <form action={regenerateAll}>
              <button className="btn-secondary" type="submit">
                ↻ Regenerate all
              </button>
            </form>
            <Link href="/matches/new" className="btn">
              + Add match
            </Link>
          </div>
        }
      />

      <div className="space-y-2">
        {matches.length === 0 && (
          <p className="text-sm text-slate-500">No matches yet. Add your first fixture.</p>
        )}
        {matches.map((m) => {
          const p = m.prediction;
          const pick = p?.manualOverride && p.overrideScore ? p.overrideScore : p?.recommendedScore;
          return (
            <Link
              key={m.id}
              href={`/matches/${m.id}`}
              className="card flex flex-wrap items-center justify-between gap-3 transition hover:border-brand"
            >
              <div className="min-w-[200px]">
                <div className="text-xs text-slate-400">
                  {m.stage ?? "Match"}
                  {m.venue ? ` · ${m.venue}` : ""}
                  {m.homeAdvantage ? " · 🏠 home advantage" : ""}
                </div>
                <div className="font-medium">
                  {m.homeTeam.name} <span className="text-slate-400">vs</span> {m.awayTeam.name}
                </div>
              </div>

              {p ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm text-slate-600">
                    Pick:{" "}
                    <span className="text-lg font-bold text-brand">{pick}</span>
                    {p.manualOverride && <span className="ml-1 text-xs text-slate-400">(override)</span>}
                  </div>
                  <ConfidenceBadge value={p.confidence} />
                  <RiskBadge value={p.risk} />
                </div>
              ) : (
                <span className="badge bg-amber-100 text-amber-700">No prediction</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
