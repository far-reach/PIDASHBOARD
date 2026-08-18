"use client";

/**
 * The candlestick + volume chart engine, shared by the hero-opened card and
 * the expanded overlay. Purely presentational: callers fetch the candles
 * and pass them in.
 *
 * Visual choices, deliberate: no vertical grid (time is already labeled on
 * the axis; the vertical lines only added noise), a whisper of horizontal
 * grid, soft-toned candles slightly translucent on the down side of volume,
 * and a dashed neutral crosshair. Optional Bollinger Bands (20, 2) render
 * as a translucent envelope, used by the fullscreen view.
 */
import { useEffect, useRef } from "react";
import { ColorType, createChart, LineStyle, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { Candle } from "@/lib/market/types";
import { computeBollinger } from "@/lib/bollinger";
import { useTheme } from "@/lib/theme";

// CVD-validated pair (deutan ΔE 11.6 vs this surface); equal weight up/down.
const UP = "#26a69a";
const DOWN = "#ef5350";

export function CandleChart({
  candles,
  height,
  bollinger = false,
}: {
  candles: Candle[];
  height: number;
  bollinger?: boolean;
}) {
  const { resolved } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const light = resolved === "light";
    const ink = light ? "#5b6472" : "#8b93a3";
    const gridInk = light ? "rgba(91, 100, 114, 0.07)" : "rgba(139, 147, 163, 0.06)";
    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: ink,
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: gridInk },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
      },
      crosshair: {
        horzLine: {
          style: LineStyle.Dashed,
          color: light ? "rgba(91,100,114,0.5)" : "rgba(139,147,163,0.5)",
          labelBackgroundColor: light ? "#d8dde6" : "#2a2f3a",
        },
        vertLine: {
          style: LineStyle.Dashed,
          color: light ? "rgba(91,100,114,0.5)" : "rgba(139,147,163,0.5)",
          labelBackgroundColor: light ? "#d8dde6" : "#2a2f3a",
        },
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
      priceLineStyle: LineStyle.Dotted,
      priceLineWidth: 1,
    });
    const volumeSeries = chart.addHistogramSeries({
      priceScaleId: "vol",
      priceFormat: { type: "volume" },
      color: "rgba(139, 147, 163, 0.3)",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });

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
        color: c.close >= c.open ? "rgba(38, 166, 154, 0.22)" : "rgba(239, 83, 80, 0.22)",
      }))
    );

    if (bollinger) {
      const bands = computeBollinger(candles);
      if (bands.length > 0) {
        const bandInk = light ? "rgba(124, 92, 191, 0.55)" : "rgba(167, 139, 250, 0.55)";
        const edgeInk = light ? "rgba(124, 92, 191, 0.30)" : "rgba(167, 139, 250, 0.30)";
        const quiet = {
          lineWidth: 1 as const,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        };
        const middle = chart.addLineSeries({ ...quiet, color: bandInk, title: "BB 20" });
        const upper = chart.addLineSeries({ ...quiet, color: edgeInk });
        const lower = chart.addLineSeries({ ...quiet, color: edgeInk });
        middle.setData(bands.map((b) => ({ time: Math.floor(b.ts / 1000) as UTCTimestamp, value: b.middle })));
        upper.setData(bands.map((b) => ({ time: Math.floor(b.ts / 1000) as UTCTimestamp, value: b.upper })));
        lower.setData(bands.map((b) => ({ time: Math.floor(b.ts / 1000) as UTCTimestamp, value: b.lower })));
      }
    }

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
    // `height` deliberately excluded: its initial value is read here, and
    // later changes are applied by the effect below without rebuilding the
    // whole chart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, resolved, bollinger]);

  useEffect(() => {
    chartRef.current?.applyOptions({ height });
  }, [height]);

  return <div ref={containerRef} className="w-full" data-testid="candle-chart" />;
}
