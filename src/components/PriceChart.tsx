"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, SegmentedControl, Skeleton } from "@/components/ui";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { CandleChart } from "@/components/CandleChart";
import { ChartOverlay } from "@/components/ChartOverlay";
import { useCandles } from "@/lib/hooks";
import { TF_OPTIONS, type Tf } from "@/lib/chart-timeframes";

export function PriceChart() {
  // The card's own timeframe, 1h by default. The fullscreen overlay keeps a
  // separate timeframe of its own (daily), so studying there never drags
  // this card away from its default.
  const [tf, setTf] = useState<Tf>("1h");
  const [expanded, setExpanded] = useState(false);
  const { data, fromCache, isLoading } = useCandles(tf);

  return (
    <>
      <Card>
        <CardHeader className="flex-wrap">
          <CardTitle>Price chart</CardTitle>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <FreshnessBadge
              source={data?.source ?? null}
              ts={data?.as_of ?? null}
              isFailover={data?.is_failover}
              fromCache={fromCache}
            />
            <SegmentedControl options={[...TF_OPTIONS]} value={tf} onChange={setTf} />
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Expand chart to fullscreen"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              data-testid="chart-expand"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && !data ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <CandleChart candles={data?.candles ?? []} height={300} />
          )}
        </CardContent>
      </Card>

      {expanded ? <ChartOverlay initialFullscreen onClose={() => setExpanded(false)} /> : null}
    </>
  );
}
