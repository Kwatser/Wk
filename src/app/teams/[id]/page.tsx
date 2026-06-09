import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteTeam, updateTeam } from "@/app/actions";
import { TeamForm } from "@/components/team-form";
import { BackLink, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = Number(id);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) notFound();

  const updateAction = updateTeam.bind(null, teamId);
  const deleteAction = deleteTeam.bind(null, teamId);

  return (
    <div>
      <BackLink href="/teams">Back to teams</BackLink>
      <PageHeader
        title={team.name}
        subtitle="Edit team data. Saving re-runs predictions for this team's matches."
        action={
          <form action={deleteAction}>
            <button className="btn-secondary text-rose-600" type="submit">
              Delete team
            </button>
          </form>
        }
      />

      {/* Provenance panel — source URLs + last updated, per requirements. */}
      <div className="card mb-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <div className="label">FIFA source</div>
            {team.fifaSourceUrl ? (
              <a
                href={team.fifaSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline break-all"
              >
                {team.fifaSourceUrl}
              </a>
            ) : (
              <span className="text-slate-400">none</span>
            )}
          </div>
          <div>
            <div className="label">FIFA ranking updated</div>
            <span>{team.fifaUpdated ?? "—"}</span>
          </div>
          <div>
            <div className="label">Data source / last updated</div>
            <span>
              {team.dataSource ?? "—"} {team.lastUpdated ? `(${team.lastUpdated})` : ""}
            </span>
          </div>
        </div>
      </div>

      <TeamForm team={team} action={updateAction} submitLabel="Save changes" />
    </div>
  );
}
