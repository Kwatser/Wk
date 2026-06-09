import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const REQUIRED_FIELDS: Array<keyof Awaited<ReturnType<typeof getTeams>>[number]> = [
  "fifaPoints",
  "recentFormScore",
  "attackStrength",
  "defenceStrength",
  "worldCupExperienceScore",
];

async function getTeams() {
  return prisma.team.findMany({ orderBy: { fifaRank: "asc" } });
}

export default async function TeamsPage() {
  const teams = await getTeams();

  return (
    <div>
      <PageHeader
        title="Teams"
        subtitle="Edit the inputs the model uses. Missing fields lower prediction quality."
        action={
          <Link href="/teams/new" className="btn">
            + Add team
          </Link>
        }
      />

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">#</th>
              <th className="th">Team</th>
              <th className="th">Conf.</th>
              <th className="th">FIFA pts</th>
              <th className="th">Form</th>
              <th className="th">Attack</th>
              <th className="th">Defence</th>
              <th className="th">WC exp</th>
              <th className="th">Data</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {teams.map((t) => {
              const missing = REQUIRED_FIELDS.filter((f) => t[f] == null).length;
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="td text-slate-400">{t.fifaRank ?? "—"}</td>
                  <td className="td font-medium">
                    <Link href={`/teams/${t.id}`} className="text-brand hover:underline">
                      {t.name}
                    </Link>
                    <span className="ml-1 text-xs text-slate-400">{t.code}</span>
                  </td>
                  <td className="td text-slate-500">{t.confederation ?? "—"}</td>
                  <td className="td">{t.fifaPoints?.toFixed(0) ?? "—"}</td>
                  <td className="td">{t.recentFormScore ?? "—"}</td>
                  <td className="td">{t.attackStrength ?? "—"}</td>
                  <td className="td">{t.defenceStrength ?? "—"}</td>
                  <td className="td">{t.worldCupExperienceScore ?? "—"}</td>
                  <td className="td">
                    {missing === 0 ? (
                      <span className="badge bg-emerald-100 text-emerald-700">complete</span>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-700">{missing} missing</span>
                    )}
                  </td>
                  <td className="td text-right">
                    <Link href={`/teams/${t.id}`} className="btn-ghost">
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
