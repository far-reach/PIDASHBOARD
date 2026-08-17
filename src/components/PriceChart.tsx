"use client";

import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Card, CardContent, CardHeader, CardTitle, SegmentedControl, Skeleton } from "@/components/ui";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { useCandles } from "@/lib/hooks";

const TF_OPTIONS = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "1h", label: "1h" },
  { value: "1d", label: "1d" },
] as const;

type Tf = (typeof TF_OPTIONS)[number]["value"];

// CVD-validated pair (deutan ΔE 11.6 vs this surface); equal weight up/down.
const UP = "#26a69a";
const DOWN = "#ef5350";

export function PriceChart() {
  const [tf, setTf] = useState<Tf>("1h");
  const { data, fromCache, isLoading } = useCandles(tf);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height: 300,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b93a3",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(139, 147, 163, 0.08)" },
        horzLines: { color: "rgba(139, 147, 163, 0.08)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { horzLine: { labelBackgroundColor: "#2a2f3a" }, vertLine: { labelBackgroundColor: "#2a2f3a" } },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
    });
    const volumeSeries = chart.addHistogramSeries({
      priceScaleId: "vol",
      priceFormat: { type: "volume" },
      color: "rgba(139, 147, 163, 0.35)",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const candles = data?.candles ?? [];
    candleSeries.setData(
      candles.map((c) => ({
        time: Math.floor(c.ts / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    volumeSeries.setData(
      candles.map((c) => ({
        time: Math.floor(c.ts / 1000) as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(38, 166, 154, 0.3)" : "rgba(239, 83, 80, 0.3)",
      }))
    );
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data]);

  return (
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
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <div ref={containerRef} className="w-full" data-testid="price-chart" />
        )}
      </CardContent>
    </Card>
  );
}
