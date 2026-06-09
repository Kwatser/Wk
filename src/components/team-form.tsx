import type { Team } from "@prisma/client";

const CONFEDERATIONS = ["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC", "OFC"];

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  step,
  min,
  max,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  placeholder?: string;
  step?: string;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="input"
      />
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

export function TeamForm({
  team,
  action,
  submitLabel,
}: {
  team?: Team;
  action: (form: FormData) => void;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4">
      <Section title="Identity">
        <Field label="Name *" name="name" defaultValue={team?.name} placeholder="Netherlands" />
        <Field label="Code (3 letters)" name="code" defaultValue={team?.code} placeholder="NED" />
        <div>
          <label className="label" htmlFor="confederation">
            Confederation
          </label>
          <select
            id="confederation"
            name="confederation"
            defaultValue={team?.confederation ?? ""}
            className="input"
          >
            <option value="">—</option>
            {CONFEDERATIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="1. FIFA world ranking">
        <Field label="FIFA rank" name="fifaRank" type="number" min={1} defaultValue={team?.fifaRank} />
        <Field label="FIFA points" name="fifaPoints" type="number" step="0.01" defaultValue={team?.fifaPoints} />
        <Field label="Source URL" name="fifaSourceUrl" defaultValue={team?.fifaSourceUrl} placeholder="https://..." />
        <Field label="Last updated" name="fifaUpdated" type="date" defaultValue={team?.fifaUpdated} />
      </Section>

      <Section title="2. Recent form">
        <Field label="Matches (5 or 10)" name="formMatches" type="number" defaultValue={team?.formMatches} />
        <Field label="Wins" name="formWins" type="number" defaultValue={team?.formWins} />
        <Field label="Draws" name="formDraws" type="number" defaultValue={team?.formDraws} />
        <Field label="Losses" name="formLosses" type="number" defaultValue={team?.formLosses} />
        <Field label="Goals for" name="formGoalsFor" type="number" defaultValue={team?.formGoalsFor} />
        <Field label="Goals against" name="formGoalsAgainst" type="number" defaultValue={team?.formGoalsAgainst} />
        <Field label="Opponent strength note" name="formOpponentNote" defaultValue={team?.formOpponentNote} />
        <Field
          label="Recent form score (0-100)"
          name="recentFormScore"
          type="number"
          min={0}
          max={100}
          defaultValue={team?.recentFormScore}
          hint="Model input"
        />
      </Section>

      <Section title="3. World Cup history">
        <Field label="Appearances" name="wcAppearances" type="number" defaultValue={team?.wcAppearances} />
        <Field label="Best result" name="wcBestResult" defaultValue={team?.wcBestResult} />
        <Field label="Recent WC performance" name="wcRecentPerformance" defaultValue={team?.wcRecentPerformance} />
        <Field label="Knockout experience note" name="knockoutExperienceNote" defaultValue={team?.knockoutExperienceNote} />
        <Field label="History note" name="wcHistoryNote" defaultValue={team?.wcHistoryNote} />
        <Field
          label="WC experience score (0-100)"
          name="worldCupExperienceScore"
          type="number"
          min={0}
          max={100}
          defaultValue={team?.worldCupExperienceScore}
          hint="Model input"
        />
      </Section>

      <Section title="4. Team strength">
        <Field
          label="Attack strength (0-100)"
          name="attackStrength"
          type="number"
          min={0}
          max={100}
          defaultValue={team?.attackStrength}
          hint="Model input"
        />
        <Field
          label="Defence strength (0-100)"
          name="defenceStrength"
          type="number"
          min={0}
          max={100}
          defaultValue={team?.defenceStrength}
          hint="Model input"
        />
        <Field label="Goalkeeping note" name="goalkeepingNote" defaultValue={team?.goalkeepingNote} />
        <Field label="Squad quality note" name="squadQualityNote" defaultValue={team?.squadQualityNote} />
      </Section>

      <Section title="5. Context & provenance">
        <Field label="Injuries / suspensions" name="injuriesNote" defaultValue={team?.injuriesNote} />
        <Field
          label="Manual adjustment (-2 to +2)"
          name="manualAdjustment"
          type="number"
          step="0.5"
          min={-2}
          max={2}
          defaultValue={team?.manualAdjustment ?? 0}
          hint="Model input"
        />
        <Field label="Data source" name="dataSource" defaultValue={team?.dataSource} />
        <Field label="Last updated (data)" name="lastUpdated" type="date" defaultValue={team?.lastUpdated} />
      </Section>

      <div className="flex gap-2">
        <button type="submit" className="btn">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
