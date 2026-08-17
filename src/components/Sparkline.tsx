"use client";

/**
 * A tap-to-expand shape of the last ~24h of price: no axes, no grid, no
 * numbers, just the silhouette. Reuses the same 1h candle series the
 * embedded chart fetches, so mounting this alongside it costs no extra
 * network call. Colored by whether the window opened up or down, matching
 * the hero's own up/down coloring elsewhere.
 */
import { useEffect, useRef } from "react";
import { ColorType, createChart, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import { useCandles } from "@/lib/hooks";
import { useTheme } from "@/lib/theme";

const UP = "#26a69a";
const DOWN = "#ef5350";

export function Sparkline({ onExpand }: { onExpand: () => void }) {
  const { data } = useCandles("1h");
  const { resolved } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    const candles = (data?.candles ?? []).slice(-24);
    if (!el || candles.length < 2) return;

    const rising = candles[candles.length - 1]!.close >= candles[0]!.close;
    const light = resolved === "light";
    const color = rising ? UP : DOWN;

    const chart = createChart(el, {
      height: 56,
      handleScroll: false,
      handleScale: false,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "transparent" },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: {
        horzLine: { visible: false, labelVisible: false },
        vertLine: { visible: false, labelVisible: false },
      },
    });
    chartRef.current = chart;

    const series = chart.addAreaSeries({
      lineColor: color,
      topColor: `${color}${light ? "26" : "40"}`,
      bottomColor: "transparent",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    series.setData(candles.map((c) => ({ time: Math.floor(c.ts / 1000) as UTCTimestamp, value: c.close })));
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, resolved]);

  if (!data?.candles || data.candles.length < 2) return null;

  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Expand price chart"
      className="mt-3 block w-full rounded-lg transition-opacity hover:opacity-70 active:opacity-60"
      data-testid="hero-sparkline"
    >
      <div ref={containerRef} className="w-full" />
    </button>
  );
}
