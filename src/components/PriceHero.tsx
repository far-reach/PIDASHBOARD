"use client";

import { useState } from "react";
import { LineChart } from "lucide-react";
import { Card, CardContent, Skeleton } from "@/components/ui";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { DecoSparkline } from "@/components/DecoSparkline";
import { PriceChart } from "@/components/PriceChart";
import { fmtPct, fmtPrice } from "@/lib/format";
import { useLatestPrice, usePiStats } from "@/lib/hooks";
import { clsx } from "clsx";

export function PriceHero() {
  const { data, fromCache, isLoading, isError } = useLatestPrice();
  // The plain-English session summary, served alongside the network stats.
  const { data: stats } = usePiStats();
  const behavior = stats?.behavior ?? null;

  // The corner button reveals a full chart card directly above this one,
  // identical in style and behavior to the dashboard's own Price chart
  // section (timeframes, freshness badge, fullscreen).
  const [chartOpen, setChartOpen] = useState(false);

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
    <>
      {chartOpen ? <PriceChart /> : null}

      <Card data-testid="price-hero" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
        />
        <DecoSparkline />
        <CardContent className="relative pt-4">
          <div className="flex items-start justify-between gap-3">
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
              <div className="mt-2">
                <FreshnessBadge
                  source={data.source}
                  ts={data.ts}
                  isStale={data.is_stale}
                  isFailover={data.is_failover}
                  divergencePct={data.divergence_pct}
                  fromCache={fromCache}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChartOpen((v) => !v)}
              aria-expanded={chartOpen}
              aria-label={chartOpen ? "Hide price chart" : "Show price chart"}
              className={clsx(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                chartOpen
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
              data-testid="hero-chart-toggle"
            >
              <LineChart size={15} />
            </button>
          </div>
          {behavior ? (
            <p
              className="mt-3 border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground"
              data-testid="behavior-line"
            >
              {behavior}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
