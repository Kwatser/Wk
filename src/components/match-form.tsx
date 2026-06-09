import type { Match, Team } from "@prisma/client";

const STAGES = [
  "Group A", "Group B", "Group C", "Group D", "Group E", "Group F",
  "Group G", "Group H", "Group I", "Group J", "Group K", "Group L",
  "Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Third place", "Final",
];

export function MatchForm({
  match,
  teams,
  action,
  submitLabel,
}: {
  match?: Match;
  teams: Pick<Team, "id" | "name">[];
  action: (form: FormData) => void;
  submitLabel: string;
}) {
  return (
    <form action={action} className="card space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="homeTeamId">
            Home team *
          </label>
          <select id="homeTeamId" name="homeTeamId" defaultValue={match?.homeTeamId ?? ""} className="input" required>
            <option value="">Select…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="awayTeamId">
            Away team *
          </label>
          <select id="awayTeamId" name="awayTeamId" defaultValue={match?.awayTeamId ?? ""} className="input" required>
            <option value="">Select…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="stage">
            Stage
          </label>
          <select id="stage" name="stage" defaultValue={match?.stage ?? ""} className="input">
            <option value="">—</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="groupMatchNumber">
            Group match # (1-3)
          </label>
          <input
            id="groupMatchNumber"
            name="groupMatchNumber"
            type="number"
            min={1}
            max={3}
            defaultValue={match?.groupMatchNumber ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="kickoff">
            Kickoff
          </label>
          <input id="kickoff" name="kickoff" type="datetime-local" defaultValue={match?.kickoff ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="venue">
            Venue
          </label>
          <input id="venue" name="venue" defaultValue={match?.venue ?? ""} className="input" placeholder="City / stadium" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="motivationNote">
            Motivation note
          </label>
          <input id="motivationNote" name="motivationNote" defaultValue={match?.motivationNote ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="contextNote">
            Context note
          </label>
          <input id="contextNote" name="contextNote" defaultValue={match?.contextNote ?? ""} className="input" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="homeAdvantage" defaultChecked={match?.homeAdvantage ?? false} className="h-4 w-4" />
        Home team plays at home (host-nation advantage)
      </label>

      <button type="submit" className="btn">
        {submitLabel}
      </button>
    </form>
  );
}
