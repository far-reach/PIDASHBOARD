"use client";

/**
 * "Today in context": how the current UTC day compares with the last ~30
 * days of the same venue's daily candles. Three observations, each with a
 * small meter. Strictly descriptive; the wording never grades or predicts.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { computeContextStats } from "@/lib/context-stats";
import { fmtPrice } from "@/lib/format";
import { useCandles, useLatestPrice } from "@/lib/hooks";

function Meter({ pct, label, value }: { pct: number; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="text-sm font-tabular font-medium">{value}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/60"
          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
        />
      </div>
    </div>
  );
}

export function ContextPanel() {
  const { data: daily } = useCandles("1d");
  const { data: price } = useLatestPrice();

  const stats = daily?.candles?.length
    ? computeContextStats(daily.candles, price?.price ?? null)
    : null;
  if (!stats) return null;

  const volPct =
    stats.volumeVsMedian !== null ? Math.min(100, stats.volumeVsMedian * 50) : null; // 2× median caps the meter

  return (
    <Card data-testid="context-panel">
      <CardHeader>
        <CardTitle>Today in context</CardTitle>
        <span className="text-[11px] text-muted-foreground">
          vs the last {stats.historyDays} days · {daily!.source}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <Meter
          pct={stats.rangePercentile}
          label="Today's range so far"
          value={`wider than ${Math.round(stats.rangePercentile)}% of days`}
        />
        {volPct !== null ? (
          <Meter
            pct={volPct}
            label={`Volume so far (${Math.round(stats.dayElapsedPct)}% of day elapsed)`}
            value={`${stats.volumeVsMedian!.toFixed(2)}× the daily median`}
          />
        ) : null}
        {stats.pricePositionPct !== null ? (
          <Meter
            pct={stats.pricePositionPct}
            label="Price within the observed band"
            value={`${Math.round(stats.pricePositionPct)}% of ${fmtPrice(stats.bandLow)}–${fmtPrice(stats.bandHigh)}`}
          />
        ) : null}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Comparisons against this venue&apos;s own daily candles. Descriptive only; past
          behaviour indicates nothing about what happens next.
        </p>
      </CardContent>
    </Card>
  );
}
