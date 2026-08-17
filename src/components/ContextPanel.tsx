"use client";

/**
 * "Today in context": how the current UTC day compares with the last ~30
 * days of the same venue's daily candles. Each row states one concrete
 * comparison in plain words, with a meter as the visual echo. Strictly
 * descriptive; the wording never grades or predicts. The reasoning behind
 * these comparisons is explained on /learn.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { computeContextStats } from "@/lib/context-stats";
import { fmtPrice } from "@/lib/format";
import { useCandles, useLatestPrice } from "@/lib/hooks";

function Row({
  pct,
  label,
  value,
  detail,
}: {
  pct: number;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-tabular font-semibold">{value}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary/60"
          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
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

  // Plain-word framing, derived from the percentile. "Typical" covers the
  // middle band where neither "quiet" nor "lively" would be honest.
  const p = stats.rangePercentile;
  const moveWord = p >= 60 ? "a livelier day than most" : p <= 40 ? "a quieter day than most" : "about a typical day";
  const moveValue =
    p >= 50 ? `wider than ${Math.round(p)}% of days` : `narrower than ${Math.round(100 - p)}% of days`;

  const volRatio = stats.volumeVsMedian;
  const volPct = volRatio !== null ? Math.min(100, volRatio * 50) : null; // 2x median fills the meter

  return (
    <Card data-testid="context-panel">
      <CardHeader>
        <CardTitle>Today in context</CardTitle>
        <span className="text-[11px] text-muted-foreground">
          vs the last {stats.historyDays} days · {daily!.source}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row
          pct={p}
          label="Price movement"
          value={`${stats.todayRangePct.toFixed(1)}% low to high`}
          detail={`Today's swing so far is ${moveValue} in the last ${stats.historyDays}: ${moveWord} so far.`}
        />
        {volRatio !== null && volPct !== null ? (
          <Row
            pct={volPct}
            label="Trading activity"
            value={`${volRatio.toFixed(2)}× the usual day`}
            detail={`Volume so far equals ${Math.round(volRatio * 100)}% of a typical full day (the ${stats.historyDays}-day median), with ${Math.round(stats.dayElapsedPct)}% of the UTC day elapsed.`}
          />
        ) : null}
        {stats.pricePositionPct !== null ? (
          <Row
            pct={stats.pricePositionPct}
            label="Where price sits"
            value={`${Math.round(stats.pricePositionPct)}% up the band`}
            detail={`Over the last ${stats.historyDays} days this venue traded between ${fmtPrice(stats.bandLow)} and ${fmtPrice(stats.bandHigh)}; the current price is ${Math.round(stats.pricePositionPct)}% of the way up that band.`}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
