import { getSettings } from "@/lib/data";
import { updateSettings } from "@/app/actions";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function WeightField({
  label,
  name,
  value,
  hint,
}: {
  label: string;
  name: string;
  value: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} type="number" step="0.01" min={0} max={1} defaultValue={value} className="input" />
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [s, sp] = await Promise.all([getSettings(), searchParams]);
  const weightSum =
    s.wFifa + s.wForm + s.wAttack + s.wDefence + s.wWcHistory + s.wHomeAdvantage + s.wManual;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Tune the prediction mode, model weights and Scorito scoring. Saving re-runs all predictions."
      />

      {sp.saved && (
        <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          ✓ Settings saved and all predictions re-generated.
        </div>
      )}

      <form action={updateSettings} className="space-y-4">
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Prediction mode
          </h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            {[
              { v: "safe", label: "Safe", desc: "Prioritise the most likely outcome." },
              { v: "balanced", label: "Balanced", desc: "Balance likely outcome with exact-score upside." },
              { v: "aggressive", label: "Aggressive", desc: "Chase differentiated scores for pool upside." },
            ].map((m) => (
              <label key={m.v} className="flex items-start gap-2 text-sm">
                <input type="radio" name="mode" value={m.v} defaultChecked={s.mode === m.v} className="mt-1" />
                <span>
                  <span className="font-medium">{m.label}</span>
                  <span className="block text-xs text-slate-500">{m.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Model weights</h3>
            <span
              className={`badge ${
                Math.abs(weightSum - 1) < 0.001 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              Sum: {weightSum.toFixed(2)} {Math.abs(weightSum - 1) < 0.001 ? "✓" : "(aim for 1.00)"}
            </span>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            The first five are weighted-averaged into each team&apos;s rating. Home advantage and manual
            adjustment are applied as additive bonuses. They don&apos;t have to sum to exactly 1, but it
            keeps the scale intuitive.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <WeightField label="FIFA ranking" name="wFifa" value={s.wFifa} />
            <WeightField label="Recent form" name="wForm" value={s.wForm} />
            <WeightField label="Attack strength" name="wAttack" value={s.wAttack} />
            <WeightField label="Defence strength" name="wDefence" value={s.wDefence} />
            <WeightField label="World Cup history" name="wWcHistory" value={s.wWcHistory} />
            <WeightField label="Home advantage" name="wHomeAdvantage" value={s.wHomeAdvantage} />
            <WeightField label="Manual adjustment" name="wManual" value={s.wManual} />
          </div>
        </div>

        <div className="card">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Scorito scoring rules
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            Used to pick the highest expected-points scoreline in balanced mode. Adjust to match your
            pool&apos;s real rules.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="exactScorePoints">
                Exact score points
              </label>
              <input id="exactScorePoints" name="exactScorePoints" type="number" step="0.5" defaultValue={s.exactScorePoints} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="correctOutcomePoints">
                Correct outcome (toto) points
              </label>
              <input id="correctOutcomePoints" name="correctOutcomePoints" type="number" step="0.5" defaultValue={s.correctOutcomePoints} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="correctGoalDiffPoints">
                Correct goal-difference points
              </label>
              <input id="correctGoalDiffPoints" name="correctGoalDiffPoints" type="number" step="0.5" defaultValue={s.correctGoalDiffPoints} className="input" />
            </div>
          </div>
        </div>

        <button type="submit" className="btn">
          Save & re-run all predictions
        </button>
      </form>
    </div>
  );
}
