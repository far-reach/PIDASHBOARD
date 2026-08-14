"use client";

/**
 * Cumulative R equity curve as a baseline chart: above 0 in the up color,
 * below 0 in the down color — drawdowns are visually impossible to hide
 * (brief §3.5). Full history, always; no timeframe cherry-picking controls.
 */
import { useEffect, useRef } from "react";
import { ColorType, createChart, type UTCTimestamp } from "lightweight-charts";
import type { PerformanceResponse } from "@/lib/api-types";

const UP = "#26a69a";
const DOWN = "#ef5350";

export function EquityChart({ curve }: { curve: PerformanceResponse["performance"]["equityCurve"] }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || curve.length === 0) return;

    const chart = createChart(el, {
      height: 220,
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
      timeScale: { borderVisible: false, timeVisible: false },
    });

    const series = chart.addBaselineSeries({
      baseValue: { type: "price", price: 0 },
      topLineColor: UP,
      topFillColor1: "rgba(38, 166, 154, 0.25)",
      topFillColor2: "rgba(38, 166, 154, 0.02)",
      bottomLineColor: DOWN,
      bottomFillColor1: "rgba(239, 83, 80, 0.02)",
      bottomFillColor2: "rgba(239, 83, 80, 0.25)",
      lineWidth: 2,
    });

    // lightweight-charts requires strictly ascending unique times; closes in
    // the same second get nudged forward.
    let lastT = 0;
    series.setData(
      curve.map((p) => {
        let t = Math.floor(new Date(p.ts).getTime() / 1000);
        if (t <= lastT) t = lastT + 1;
        lastT = t;
        return { time: t as UTCTimestamp, value: p.cumR };
      })
    );
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [curve]);

  if (curve.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No closed signals yet.</p>;
  }
  return <div ref={ref} className="w-full" data-testid="equity-chart" />;
}
