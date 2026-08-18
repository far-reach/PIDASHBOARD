"use client";

import { useState } from "react";
import { Maximize2, X } from "lucide-react";
import { Card, CardContent, SegmentedControl, Skeleton } from "@/components/ui";
import { CandleChart } from "@/components/CandleChart";
import { ChartOverlay } from "@/components/ChartOverlay";
import { useCandles } from "@/lib/hooks";
import { TF_OPTIONS, type Tf } from "@/lib/chart-timeframes";

/**
 * The chart card revealed from the price hero. Compact by design: one
 * control row, no title block and no freshness chip (the hero above already
 * states the source and time), so the candles get the card's height rather
 * than the chrome.
 */
export function PriceChart({ onClose }: { onClose?: () => void }) {
  // The card's own timeframe, 1h by default. The fullscreen overlay keeps a
  // separate timeframe of its own (daily), so studying there never drags
  // this card away from its default.
  const [tf, setTf] = useState<Tf>("1h");
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useCandles(tf);

  return (
    <>
      <Card>
        <CardContent className="space-y-2 px-2 pb-2 pt-2">
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <SegmentedControl options={[...TF_OPTIONS]} value={tf} onChange={setTf} />
            </div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Expand chart to fullscreen"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              data-testid="chart-expand"
            >
              <Maximize2 size={14} />
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close price chart"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                data-testid="chart-card-close"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>
          {isLoading && !data ? (
            <Skeleton className="h-[340px] w-full" />
          ) : (
            <CandleChart candles={data?.candles ?? []} height={340} />
          )}
        </CardContent>
      </Card>

      {expanded ? <ChartOverlay onClose={() => setExpanded(false)} /> : null}
    </>
  );
}
