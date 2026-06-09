import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const [matchCount, predictionCount] = await Promise.all([
    prisma.match.count(),
    prisma.prediction.count(),
  ]);

  return (
    <div>
      <PageHeader
        title="Export"
        subtitle="Download all predictions as CSV to keep alongside your Scorito entries."
      />

      <div className="card max-w-xl">
        <p className="text-sm text-slate-600">
          The CSV contains every match with the recommended, safe and aggressive scores, your manual
          override (if any), 1X2 probabilities, expected goals, confidence, risk and data completeness.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <a href="/api/export" className="btn" download>
            ⤓ Download predictions.csv
          </a>
          <span className="text-sm text-slate-500">
            {predictionCount} prediction{predictionCount === 1 ? "" : "s"} across {matchCount} match
            {matchCount === 1 ? "" : "es"}
          </span>
        </div>
      </div>
    </div>
  );
}
