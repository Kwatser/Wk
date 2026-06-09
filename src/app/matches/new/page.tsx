import { prisma } from "@/lib/prisma";
import { createMatch } from "@/app/actions";
import { MatchForm } from "@/components/match-form";
import { BackLink, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  const teams = await prisma.team.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div>
      <BackLink href="/matches">Back to matches</BackLink>
      <PageHeader title="Add match" subtitle="A prediction is generated automatically when you save." />
      {teams.length < 2 ? (
        <p className="text-sm text-amber-600">You need at least two teams first.</p>
      ) : (
        <MatchForm teams={teams} action={createMatch} submitLabel="Create match & predict" />
      )}
    </div>
  );
}
