import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteMatch, updateMatch } from "@/app/actions";
import { MatchForm } from "@/components/match-form";
import { BackLink, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matchId = Number(id);
  const [match, teams] = await Promise.all([
    prisma.match.findUnique({ where: { id: matchId } }),
    prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!match) notFound();

  const update = updateMatch.bind(null, matchId);
  const remove = deleteMatch.bind(null, matchId);

  return (
    <div>
      <BackLink href={`/matches/${matchId}`}>Back to match</BackLink>
      <PageHeader
        title="Edit match"
        subtitle="Saving re-runs the prediction."
        action={
          <form action={remove}>
            <button className="btn-secondary text-rose-600" type="submit">
              Delete match
            </button>
          </form>
        }
      />
      <MatchForm match={match} teams={teams} action={update} submitLabel="Save & re-predict" />
    </div>
  );
}
