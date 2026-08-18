"use client";

/**
 * The expanded chart, reachable from the hero sparkline (opens medium/
 * "vertical mode") or the dashboard chart card's expand button (opens
 * straight to fullscreen, since the card already shows the medium view
 * inline). Two sizes only, both portrait: a tall panel and true fullscreen;
 * neither ever asks for landscape, which most trading apps do and which is
 * awkward to use one-handed.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";
import { FreshnessBadge } from "@/components/FreshnessBadge";
import { CandleChart } from "@/components/CandleChart";
import { SegmentedControl } from "@/components/ui";
import { TF_OPTIONS, type Tf } from "@/lib/chart-timeframes";
import type { Candle } from "@/lib/market/types";

const FALLBACK_HEADER_H = 96; // two-row header before the ref has measured

/**
 * The header wraps to two rows at narrow widths (see the freshness badge vs
 * timeframe-picker collision this replaced), so its real height varies with
 * viewport width and content and cannot be a constant; it is measured.
 */
function useChartHeight(fullscreen: boolean, headerHeight: number): number {
  const [h, setH] = useState(() =>
    typeof window === "undefined"
      ? 400
      : chartHeightFor(fullscreen, headerHeight || FALLBACK_HEADER_H)
  );
  useEffect(() => {
    const update = () => setH(chartHeightFor(fullscreen, headerHeight || FALLBACK_HEADER_H));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [fullscreen, headerHeight]);
  return h;
}

function chartHeightFor(fullscreen: boolean, headerHeight: number): number {
  const vh = window.innerHeight;
  return fullscreen
    ? Math.max(280, vh - headerHeight - 8)
    : Math.max(280, Math.min(520, Math.round(vh * 0.55)));
}

export function ChartOverlay({
  tf,
  onTfChange,
  candles,
  source,
  asOf,
  isFailover,
  fromCache,
  initialFullscreen = false,
  onClose,
}: {
  tf: Tf;
  onTfChange: (tf: Tf) => void;
  candles: Candle[];
  source: string | null;
  asOf: string | null;
  isFailover?: boolean;
  fromCache?: boolean;
  initialFullscreen?: boolean;
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(initialFullscreen);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(FALLBACK_HEADER_H);
  const chartHeight = useChartHeight(fullscreen, headerHeight);

  // Fullscreen is the study view: it opens on the daily timeframe with
  // Bollinger Bands (20, 2). The switch happens once per fullscreen entry;
  // the reader is free to change timeframe afterwards without being
  // overridden.
  const autoDailyDone = useRef(false);
  useEffect(() => {
    if (fullscreen && !autoDailyDone.current) {
      autoDailyDone.current = true;
      if (tf !== "1d") onTfChange("1d");
    }
    if (!fullscreen) autoDailyDone.current = false;
  }, [fullscreen, tf, onTfChange]);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
      <div
        className={
          fullscreen
            ? "flex h-full w-full flex-col"
            : "flex w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl"
        }
      >
        <div
          ref={headerRef}
          className={
            fullscreen
              ? "space-y-2 border-b border-border px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
              : "space-y-2 border-b border-border px-4 py-2.5"
          }
        >
          {/* Row 1: identity + the two size controls. Never crowded: this
              row alone must always fit at 375px. */}
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
          {/* Row 2: the freshness badge and timeframe picker wrap onto their
              own row, so a long "okx · as of HH:MM:SS UTC" chip never
              collides with the timeframe pills at narrow widths. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FreshnessBadge source={source} ts={asOf} isFailover={isFailover} fromCache={fromCache} />
            <div className="flex items-center gap-2">
              {fullscreen ? (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Bollinger 20 · 2σ
                </span>
              ) : null}
              <SegmentedControl options={[...TF_OPTIONS]} value={tf} onChange={onTfChange} />
            </div>
          </div>
        </div>
        <div className="px-2 pb-2 pt-1">
          <CandleChart candles={candles} height={chartHeight} bollinger={fullscreen} />
        </div>
      </div>
    </div>,
    document.body
  );
}
