import Link from "next/link";

export function ConfidenceBadge({ value }: { value: string }) {
  const cls =
    value === "High"
      ? "bg-emerald-100 text-emerald-700"
      : value === "Medium"
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";
  return <span className={`badge ${cls}`}>Confidence: {value}</span>;
}

export function RiskBadge({ value }: { value: string }) {
  const cls =
    value === "Low"
      ? "bg-emerald-100 text-emerald-700"
      : value === "Medium"
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";
  return <span className={`badge ${cls}`}>Risk: {value}</span>;
}

/** Horizontal 1X2 probability bar. */
export function ProbBar({
  pHome,
  pDraw,
  pAway,
  home,
  away,
}: {
  pHome: number;
  pDraw: number;
  pAway: number;
  home: string;
  away: string;
}) {
  const h = Math.round(pHome * 100);
  const d = Math.round(pDraw * 100);
  const a = Math.max(0, 100 - h - d);
  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded-md text-xs font-medium text-white">
        <div className="flex items-center justify-center bg-brand" style={{ width: `${h}%` }}>
          {h > 8 ? `${h}%` : ""}
        </div>
        <div className="flex items-center justify-center bg-slate-400" style={{ width: `${d}%` }}>
          {d > 8 ? `${d}%` : ""}
        </div>
        <div className="flex items-center justify-center bg-rose-500" style={{ width: `${a}%` }}>
          {a > 8 ? `${a}%` : ""}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{home} win</span>
        <span>Draw</span>
        <span>{away} win</span>
      </div>
    </div>
  );
}

export function ScoreChip({ label, score, accent }: { label: string; score: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 text-center ${
        accent ? "border-brand bg-brand/5" : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-brand" : "text-slate-800"}`}>
        {score}
      </div>
    </div>
  );
}

export function DataWarning({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
      <div className="font-semibold">⚠ Data quality warning</div>
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-brand hover:underline">
      ← {children}
    </Link>
  );
}
