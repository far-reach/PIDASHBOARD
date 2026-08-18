"use client";

/**
 * The fullscreen study chart: the whole display, in whatever orientation
 * the device is held, on the daily timeframe with Bollinger Bands (20, 2).
 *
 * Fullscreen-only, deliberately. It used to carry a second "medium panel"
 * size, but the only way in is the dashboard card's expand button; the
 * medium size was reachable ONLY by collapsing out of fullscreen: a
 * surface the reader never asked for, on a timeframe they never chose.
 * Collapse now simply returns to the page, where the card sits exactly as
 * it was left. One expand button, one fullscreen view, one way back.
 *
 * The earlier CSS-rotated "forced landscape" stays gone: rotating a canvas
 * layer made iOS rasterize it soft and broke the chart's touch math.
 * Where the platform allows it we ask for a landscape orientation lock;
 * everywhere else, turning the phone is picked up by the resize listener.
 *
 * The overlay fetches its own candles and keeps its own timeframe, so
 * studying daily here never drags the dashboard card away from its 1h.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minimize2 } from "lucide-react";
import { CandleChart } from "@/components/CandleChart";
import { SegmentedControl } from "@/components/ui";
import { TF_OPTIONS, type Tf } from "@/lib/chart-timeframes";
import { useCandles } from "@/lib/hooks";

const FALLBACK_HEADER_H = 96;

export function ChartOverlay({ onClose }: { onClose: () => void }) {
  const [tf, setTf] = useState<Tf>("1d");
  const { data } = useCandles(tf);

  // Viewport dimensions drive chart sizing.
  const [dims, setDims] = useState(() =>
    typeof window === "undefined"
      ? { w: 375, h: 700 }
      : { w: window.innerWidth, h: window.innerHeight }
  );
  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // Progressive enhancement: platforms that allow it (Android Chrome and
  // friends, inside the Fullscreen API) get a real landscape lock. Failures
  // are expected and silent; iOS simply ignores this path.
  useEffect(() => {
    let locked = false;
    void (async () => {
      try {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (o: string) => Promise<void>;
        };
        if (!orientation?.lock) return;
        await document.documentElement.requestFullscreen?.();
        await orientation.lock("landscape");
        locked = true;
      } catch {
        /* not supported here: turning the phone still works */
      }
    })();
    return () => {
      if (locked) {
        try {
          screen.orientation.unlock();
        } catch {
          /* ignore */
        }
        void document.exitFullscreen?.().catch(() => undefined);
      }
    };
  }, []);

  // The header wraps to two rows at narrow widths, so its height is
  // measured, not assumed; the chart gets every remaining pixel.
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(FALLBACK_HEADER_H);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const chartHeight = Math.max(220, dims.h - headerHeight - 8);

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

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Price chart, fullscreen"
      data-testid="chart-overlay"
    >
      <div className="flex h-full w-full flex-col">
        <div ref={headerRef} className="space-y-2 border-b border-border px-3 py-2">
          {/* Row 1: identity + the way back to the page. */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">PIUSDT</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Collapse back to the page"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              data-testid="chart-close"
            >
              <Minimize2 size={15} />
            </button>
          </div>
          {/* Row 2: timeframe picker, with the study-view band label beside it. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Bollinger 20 · 2σ
            </span>
            <SegmentedControl options={[...TF_OPTIONS]} value={tf} onChange={setTf} />
          </div>
        </div>
        <div className="px-2 pb-2 pt-1">
          <CandleChart candles={candles} height={chartHeight} bollinger />
        </div>
      </div>
    </div>,
    document.body
  );
}
