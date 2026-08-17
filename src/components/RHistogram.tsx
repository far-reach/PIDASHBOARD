"use client";

/**
 * R-multiple distribution. Loss bins and win bins use the same bar
 * geometry and label treatment; identical visual weight (brief §8).
 */
import type { PerformanceResponse } from "@/lib/api-types";

export function RHistogram({
  histogram,
}: {
  histogram: PerformanceResponse["performance"]["histogram"];
}) {
  const max = Math.max(1, ...histogram.map((b) => b.count));
  const nonEmpty = histogram.some((b) => b.count > 0);
  if (!nonEmpty) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No closed signals yet.</p>;
  }

  return (
    <div className="space-y-1" data-testid="r-histogram" role="img" aria-label="R multiple distribution">
      {histogram.map((bin) => {
        const isLoss = bin.to <= 0;
        return (
          <div key={bin.label} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-[11px] text-muted-foreground font-tabular text-right">
              {bin.label}
            </span>
            <div className="flex-1 h-4 rounded-sm bg-muted overflow-hidden">
              <div
                className={isLoss ? "h-full bg-down" : "h-full bg-up"}
                style={{ width: `${(bin.count / max) * 100}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-[11px] font-tabular text-muted-foreground">
              {bin.count > 0 ? bin.count : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
