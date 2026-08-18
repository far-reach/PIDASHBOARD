"use client";

/**
 * The expanded chart. Two sizes:
 * - medium "vertical mode": a tall portrait panel over the page;
 * - fullscreen: the whole display, and on a portrait phone the view is
 *   rotated 90° so the chart is LANDSCAPE without asking the reader to
 *   flip their device or the browser to support orientation lock (Pi
 *   Browser's iOS webview does not). On a device already wider than tall
 *   it simply fills the screen unrotated.
 *
 * Fullscreen is the study view: it opens on the daily timeframe with
 * Bollinger Bands (20, 2). The overlay fetches its own candles and keeps
 * its own timeframe, so studying daily here never drags the dashboard
 * card away from its 1h default.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";
import { CandleChart } from "@/components/CandleChart";
import { SegmentedControl } from "@/components/ui";
import { TF_OPTIONS, type Tf } from "@/lib/chart-timeframes";
import { useCandles } from "@/lib/hooks";

const FALLBACK_HEADER_H = 96;

export function ChartOverlay({
  initialFullscreen = false,
  onClose,
}: {
  initialFullscreen?: boolean;
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(initialFullscreen);
  const [tf, setTf] = useState<Tf>(initialFullscreen ? "1d" : "1h");
  const { data } = useCandles(tf);

  // Entering fullscreen (from the medium panel's expand button) switches to
  // daily once per entry; the reader's later choice is respected.
  const autoDailyDone = useRef(initialFullscreen);
  useEffect(() => {
    if (fullscreen && !autoDailyDone.current) {
      autoDailyDone.current = true;
      setTf("1d");
    }
    if (!fullscreen) autoDailyDone.current = false;
  }, [fullscreen]);

  // Viewport dimensions drive both the rotation decision and chart sizing.
  // Rounded to whole pixels: a rotated layer positioned on a fractional
  // pixel is resampled by the compositor, which is what made the landscape
  // chart look soft and smeared.
  const [dims, setDims] = useState(() =>
    typeof window === "undefined"
      ? { w: 375, h: 700 }
      : { w: Math.round(window.innerWidth), h: Math.round(window.innerHeight) }
  );
  useEffect(() => {
    const update = () =>
      setDims({ w: Math.round(window.innerWidth), h: Math.round(window.innerHeight) });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const rotated = fullscreen && dims.h > dims.w;

  // The header wraps to two rows at narrow widths, so its height is
  // measured, not assumed. offsetHeight is layout height: unaffected by the
  // rotation transform, which is exactly what the math needs.
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(FALLBACK_HEADER_H);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // In the rotated frame the chart's available height is the device WIDTH.
  const chartHeight = fullscreen
    ? Math.max(220, (rotated ? dims.w : dims.h) - headerHeight - 8)
    : Math.max(280, Math.min(520, Math.round(dims.h * 0.55)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const candles = data?.candles ?? [];

  const header = (
    <div ref={headerRef} className="space-y-2 border-b border-border px-3 py-2">
      {/* Row 1: identity + size controls; always fits on its own. */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">PIUSDT</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            aria-label={fullscreen ? "Collapse chart" : "Expand chart to fullscreen"}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            data-testid="chart-fullscreen-toggle"
          >
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chart"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            data-testid="chart-close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {/* Row 2: timeframe picker, with the study-view band label beside it. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {fullscreen ? (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Bollinger 20 · 2σ
          </span>
        ) : (
          <span />
        )}
        <SegmentedControl options={[...TF_OPTIONS]} value={tf} onChange={setTf} />
      </div>
    </div>
  );

  const body = (
    <>
      {header}
      <div className="px-2 pb-2 pt-1">
        <CandleChart candles={candles} height={chartHeight} bollinger={fullscreen} />
      </div>
    </>
  );

  return createPortal(
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 bg-background"
          : "fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      }
      role="dialog"
      aria-modal="true"
      aria-label="Price chart, expanded"
      data-testid="chart-overlay"
      onClick={(e) => {
        if (!fullscreen && e.target === e.currentTarget) onClose();
      }}
    >
      {fullscreen ? (
        rotated ? (
          // Landscape by construction: a wrapper sized to the rotated
          // viewport (its width is the device height), turned -90° so the
          // header lands on the left and the chart reads left-to-right the
          // way it would if the phone were turned clockwise.
          <div
            className="flex flex-col overflow-hidden bg-background"
            style={{
              width: dims.h,
              height: dims.w,
              transform: "rotate(-90deg) translateX(-100%)",
              transformOrigin: "top left",
              backfaceVisibility: "hidden",
            }}
            data-testid="chart-rotated"
          >
            {body}
          </div>
        ) : (
          <div className="flex h-full w-full flex-col">{body}</div>
        )
      ) : (
        <div className="flex w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl">
          {body}
        </div>
      )}
    </div>,
    document.body
  );
}
