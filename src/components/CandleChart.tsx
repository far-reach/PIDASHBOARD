"use client";

/**
 * The candlestick + volume chart engine, shared by the hero-opened card and
 * the expanded overlay. Purely presentational: callers fetch the candles
 * and pass them in.
 *
 * Feel, deliberate:
 * - The default view is a balanced recent window (~50 bars), never the whole
 *   series squeezed into one screen; history is a swipe away.
 * - Kinetic scrolling on touch and mouse, so a flick glides and settles.
 * - On load and on timeframe change the view settles in with a slight
 *   overshoot, which reads as alive without getting in the way.
 * - Double-tap (or double-click) returns to the default view, animated.
 *
 * Visual choices: no vertical grid, a whisper of horizontal grid, soft
 * volume, dashed neutral crosshair. Optional Bollinger Bands (20, 2) render
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

/** Ease with a small overshoot: the "settle" that makes the view feel alive. */
function easeOutBack(t: number): number {
  const c1 = 1.1;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

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
  const rafRef = useRef(0);

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
        rightOffset: 3,
        minBarSpacing: 0.5,
      },
      // A flick keeps gliding and eases to a stop instead of halting dead.
      kineticScroll: { touch: true, mouse: true },
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

    /*
     * The balanced default: roughly the last 50 bars at a comfortable
     * spacing, never the entire series squeezed into one screen. Sparse
     * series still fit-to-content, since there is nothing to trim.
     */
    const ts = chart.timeScale();
    const width = el.clientWidth || 340;
    const targetSpacing = Math.min(14, Math.max(5, width / 50));
    const visibleAtTarget = width / targetSpacing;

    const settleIn = () => {
      cancelAnimationFrame(rafRef.current);
      if (candles.length <= visibleAtTarget) {
        ts.fitContent();
        return;
      }
      const from = targetSpacing * 0.7; // start a touch zoomed-out…
      ts.applyOptions({ barSpacing: from });
      ts.scrollToRealTime();
      const start = performance.now();
      const dur = 420;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        // …and settle onto the target with a slight overshoot.
        ts.applyOptions({ barSpacing: from + (targetSpacing - from) * easeOutBack(t) });
        if (t < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    };
    settleIn();

    // Double-tap (dblclick fires for double-taps in mobile webviews too)
    // brings the wandered view home, animated.
    const resetView = () => {
      settleIn();
      ts.scrollToPosition(3, true);
    };
    el.addEventListener("dblclick", resetView);

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafRef.current);
      el.removeEventListener("dblclick", resetView);
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
