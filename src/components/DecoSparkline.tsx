"use client";

/**
 * Ambient art, not a chart: the last ~24h of price as a smooth line drawn
 * into the hero card's right side, flowing down behind the session-summary
 * text. Bright enough to read as movement near the top, fading to
 * almost-nothing where text sits over it. Pure SVG from the same 1h candle
 * series the real charts fetch; decorative only (aria-hidden, no pointer
 * events, no axes, no numbers).
 */
import { useId } from "react";
import { useCandles } from "@/lib/hooks";

/** Catmull-Rom → cubic Bézier, for a soft, artistic line. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function DecoSparkline() {
  const { data } = useCandles("1h");
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const closes = (data?.candles ?? []).slice(-24).map((c) => c.close);
  if (closes.length < 3) return null;

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  // The line lives in the upper band (12..58 of 100) so its glow, not its
  // body, is what reaches the text region below.
  const pts = closes.map((v, i) => ({
    x: (i / (closes.length - 1)) * 100,
    y: 58 - ((v - min) / span) * 46,
  }));
  const line = smoothPath(pts);
  const area = `${line} L 100 100 L 0 100 Z`;

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-y-0 right-0 h-full w-[58%] text-primary [mask-image:linear-gradient(to_left,black_55%,transparent_98%)]"
    >
      <defs>
        {/* Stroke fades with depth: visible movement up top, a whisper below. */}
        <linearGradient id={`ds-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.5" />
          <stop offset="0.55" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`df-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#df-${uid})`} />
      <path
        d={line}
        fill="none"
        stroke={`url(#ds-${uid})`}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
