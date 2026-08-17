"use client";

import { useState } from "react";
import { Card, CardContent, Skeleton } from "@/components/ui";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { Sparkline } from "@/components/Sparkline";
import { ChartOverlay } from "@/components/ChartOverlay";
import { fmtPct, fmtPrice } from "@/lib/format";
import { useCandles, useLatestPrice, usePiStats } from "@/lib/hooks";
import type { Tf } from "@/lib/chart-timeframes";
import { clsx } from "clsx";

export function PriceHero() {
  const { data, fromCache, isLoading, isError } = useLatestPrice();
  // The plain-English session summary, served alongside the network stats.
  const { data: stats } = usePiStats();
  const behavior = stats?.behavior ?? null;

  // The sparkline's own expand path, independent of the dashboard chart
  // card's timeframe: this is a separate mounted chart, opened as the
  // medium "vertical mode" panel rather than straight to fullscreen, since
  // (unlike the card) nothing is already visible on the page to expand from.
  const [chartTf, setChartTf] = useState<Tf>("1h");
  const [chartOpen, setChartOpen] = useState(false);
  const { data: chartData, fromCache: chartFromCache } = useCandles(chartTf);

  if (isLoading && !data) {
    return (
      <Card>
        <CardContent className="pt-4">
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            Price feed unavailable right now. All sources are unreachable; retrying automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  const change = data.change_pct_24h;
  const changeTone = change === null ? undefined : change >= 0 ? "text-up" : "text-down";

  return (
    <Card data-testid="price-hero" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
      />
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">PI / USDT</span>
              <span className={clsx("text-sm font-semibold font-tabular", changeTone)}>
                {change !== null ? `${fmtPct(change)} 24h` : ""}
              </span>
            </div>
            <div className="text-5xl font-bold font-tabular tracking-tight mt-0.5">
              {fmtPrice(data.price)}
            </div>
          </div>
          <FreshnessBadge
            source={data.source}
            ts={data.ts}
            isStale={data.is_stale}
            isFailover={data.is_failover}
            divergencePct={data.divergence_pct}
            fromCache={fromCache}
          />
        </div>
        {behavior ? (
          <p
            className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground"
            data-testid="behavior-line"
          >
            {behavior}
          </p>
        ) : null}
        <Sparkline onExpand={() => setChartOpen(true)} />
      </CardContent>

      {chartOpen ? (
        <ChartOverlay
          tf={chartTf}
          onTfChange={setChartTf}
          candles={chartData?.candles ?? []}
          source={chartData?.source ?? null}
          asOf={chartData?.as_of ?? null}
          isFailover={chartData?.is_failover}
          fromCache={chartFromCache}
          onClose={() => setChartOpen(false)}
        />
      ) : null}
    </Card>
  );
}
