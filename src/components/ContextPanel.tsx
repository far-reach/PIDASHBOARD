"use client";

/**
 * "Today in context": how the current UTC day compares with recent days.
 *
 * The first two rows compare LIKE FOR LIKE, against the same hours of prior
 * days (see lib/intraday-context): comparing a young day against completed
 * days made every morning read as unusually quiet, which was arithmetic
 * rather than market behaviour. The third row needs no such treatment,
 * because a price's position inside a 30-day band does not depend on how
 * far into today we are.
 *
 * Each row's value and bar are the finding; the explanatory sentence beneath
 * mostly restates it in words, so it starts collapsed and expands on tap
 * rather than running by default on every visit.
 *
 * Strictly descriptive: each row states what the recorded data shows and
 * names its own window. Nothing projects or forecasts.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { computeContextStats } from "@/lib/context-stats";
import { computeIntradayContext, hoursLabel } from "@/lib/intraday-context";
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
  const [open, setOpen] = useState(false);
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/80 hover:text-muted-foreground"
      >
        <ChevronDown
          size={11}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
        {open ? "Hide how this is measured" : "How this is measured"}
      </button>
      {open ? <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

/** "narrower than every one" reads better than "narrower than 100% of". */
function comparisonPhrase(percentile: number, days: number): string {
  const rounded = Math.round(percentile);
  if (rounded === 0) return `the narrowest of the last ${days}`;
  if (rounded === 100) return `the widest of the last ${days}`;
  return rounded >= 50
    ? `wider than ${rounded}% of the last ${days}`
    : `narrower than ${100 - rounded}% of the last ${days}`;
}

export function ContextPanel() {
  const { data: daily } = useCandles("1d");
  const { data: hourly } = useCandles("1h");
  const { data: price } = useLatestPrice();

  const intraday = hourly?.candles?.length ? computeIntradayContext(hourly.candles) : null;
  const band = daily?.candles?.length
    ? computeContextStats(daily.candles, price?.price ?? null)
    : null;
  if (!intraday && !band) return null;

  const volPct =
    intraday?.volumeVsTypical != null ? Math.min(100, intraday.volumeVsTypical * 50) : null;
  const window = intraday ? hoursLabel(intraday.elapsedHours) : "";

  return (
    <Card data-testid="context-panel">
      <CardHeader>
        <CardTitle>Today in context</CardTitle>
        <span className="text-[11px] text-muted-foreground">{daily?.source ?? hourly?.source}</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {intraday ? (
          <>
            <Row
              pct={intraday.rangePercentile}
              label="Price movement"
              value={`${intraday.todayRangePct.toFixed(1)}% low to high`}
              detail={`Measured over the first ${window} of the UTC day, and against the same ${window} of the previous ${intraday.comparableDays} days: ${comparisonPhrase(intraday.rangePercentile, intraday.comparableDays)}.`}
            />
            {intraday.volumeVsTypical != null && volPct != null ? (
              <Row
                pct={volPct}
                label="Trading activity"
                value={`${intraday.volumeVsTypical.toFixed(2)}× typical`}
                detail={`Volume in the first ${window} of the UTC day, against the median of the same ${window} on the previous ${intraday.comparableDays} days.`}
              />
            ) : null}
          </>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            The UTC day is too young to compare against previous days yet. Comparisons appear
            once its first full hour has completed.
          </p>
        )}

        {band?.pricePositionPct != null ? (
          <Row
            pct={band.pricePositionPct}
            label="Where price sits"
            value={`${Math.round(band.pricePositionPct)}% up the band`}
            detail={`Over the last ${band.historyDays} days this venue traded between ${fmtPrice(band.bandLow)} and ${fmtPrice(band.bandHigh)}; the current price is ${Math.round(band.pricePositionPct)}% of the way up that band.`}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
