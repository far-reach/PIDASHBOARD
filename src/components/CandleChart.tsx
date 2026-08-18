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
import { chartPalette } from "@/lib/chart-palette";
import { useTheme } from "@/lib/theme";

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
  const { pref } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const c = chartPalette(pref);
    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: c.ink,
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: c.grid },
      },
      rightPriceScale: {
        borderVisible: false,
        // Tight: just enough headroom for the price label, and only as much
        // floor as the volume strip actually occupies.
        scaleMargins: { top: 0.04, bottom: 0.16 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        // Just enough breathing room past the newest candle for its price
        // label; more than this leaves a dead strip on the right.
        rightOffset: 1,
        minBarSpacing: 0.5,
      },
      // A flick keeps gliding and eases to a stop instead of halting dead.
      kineticScroll: { touch: true, mouse: true },
      crosshair: {
        horzLine: {
          style: LineStyle.Dashed,
          color: c.crosshair,
          labelBackgroundColor: c.crosshairLabel,
        },
        vertLine: {
          style: LineStyle.Dashed,
          color: c.crosshair,
          labelBackgroundColor: c.crosshairLabel,
        },
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: c.up,
      downColor: c.down,
      wickUpColor: c.up,
      wickDownColor: c.down,
      borderVisible: false,
      priceLineStyle: LineStyle.Dotted,
      priceLineWidth: 1,
    });
    const volumeSeries = chart.addHistogramSeries({
      priceScaleId: "vol",
      priceFormat: { type: "volume" },
      color: c.upVolume, // per-bar colors override this; kept in-theme anyway
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });

    candleSeries.setData(
      candles.map((candle) => ({
        time: Math.floor(candle.ts / 1000) as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }))
    );
    volumeSeries.setData(
      candles.map((candle) => ({
        time: Math.floor(candle.ts / 1000) as UTCTimestamp,
        value: candle.volume,
        color: candle.close >= candle.open ? c.upVolume : c.downVolume,
      }))
    );

    if (bollinger) {
      const bands = computeBollinger(candles);
      if (bands.length > 0) {
        const bandInk = c.bandLine;
        const edgeInk = c.bandEdge;
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
        // Re-anchor every frame: the bars widen as this runs, so a single
        // anchor at the start would let the series drift left and leave a
        // dead strip against the price scale.
        ts.scrollToRealTime();
        if (t < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    };
    settleIn();

    // Double-tap (dblclick fires for double-taps in mobile webviews too)
    // brings the wandered view home, animated.
    const resetView = () => settleIn();
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
  }, [candles, pref, bollinger]);

  useEffect(() => {
    chartRef.current?.applyOptions({ height });
  }, [height]);

  return <div ref={containerRef} className="w-full" data-testid="candle-chart" />;
}
