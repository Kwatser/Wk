import { createTeam } from "@/app/actions";
import { TeamForm } from "@/components/team-form";
import { BackLink, PageHeader } from "@/components/ui";

export default function NewTeamPage() {
  return (
    <div>
      <BackLink href="/teams">Back to teams</BackLink>
      <PageHeader title="Add team" subtitle="Fill in as much as you can — the model degrades gracefully when data is missing." />
      <TeamForm action={createTeam} submitLabel="Create team" />
    </div>
  );
}
