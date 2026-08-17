"use client";

/**
 * The candlestick + volume chart engine, extracted from PriceChart so the
 * same drawing code can be mounted inline (the dashboard card) or inside
 * ChartOverlay (the expanded/fullscreen views) at a different height.
 * Purely presentational: callers fetch the candles and pass them in.
 */
import { useEffect, useRef } from "react";
import { ColorType, createChart, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/market/types";
import { useTheme } from "@/lib/theme";

// CVD-validated pair (deutan ΔE 11.6 vs this surface); equal weight up/down.
const UP = "#26a69a";
const DOWN = "#ef5350";

export function CandleChart({ candles, height }: { candles: Candle[]; height: number }) {
  const { resolved } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const light = resolved === "light";
    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: light ? "#5b6472" : "#8b93a3",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: light ? "rgba(91, 100, 114, 0.10)" : "rgba(139, 147, 163, 0.08)" },
        horzLines: { color: light ? "rgba(91, 100, 114, 0.10)" : "rgba(139, 147, 163, 0.08)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        horzLine: { labelBackgroundColor: light ? "#d8dde6" : "#2a2f3a" },
        vertLine: { labelBackgroundColor: light ? "#d8dde6" : "#2a2f3a" },
      },
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
    // `height` deliberately excluded: its only initial value is read here,
    // and later changes are applied by the effect below without rebuilding
    // the whole chart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, resolved]);

  // Height alone changes when the overlay toggles fullscreen; applying it
  // directly avoids tearing down and rebuilding the whole chart for a resize.
  useEffect(() => {
    chartRef.current?.applyOptions({ height });
  }, [height]);

  return <div ref={containerRef} className="w-full" data-testid="candle-chart" />;
}
