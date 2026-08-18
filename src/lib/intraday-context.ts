/**
 * Like-for-like comparison of the current UTC day against recent days.
 *
 * The naive version of this compares a two-hour-old day against thirty
 * COMPLETED days, which is not a comparison at all: a young day will almost
 * always show a narrower range and less volume, so the app ends up reporting
 * "quieter than usual" every morning as a matter of arithmetic rather than
 * of market behaviour.
 *
 * This module fixes that by measuring prior days over the SAME window: if
 * four hours of today have completed, each prior day is truncated to its
 * own first four hours before being compared. Only whole elapsed hours count
 * on both sides, so the in-progress hour never makes today look artificially
 * light.
 *
 * Everything here is descriptive arithmetic on observed candles. Nothing
 * projects a full day, and nothing forecasts.
 */
import type { Candle } from "@/lib/market/types";

export interface IntradayContext {
  /** Whole hours of the current UTC day observed so far. */
  elapsedHours: number;
  /** Prior UTC days with at least that many hours, used as the comparison. */
  comparableDays: number;
  /** Today's high-low span over those hours, as % of its low. */
  todayRangePct: number;
  /** Share of comparable days whose same-window span was narrower, 0..100. */
  rangePercentile: number;
  /** Today's volume over those hours ÷ the median of the same window. */
  volumeVsTypical: number | null;
}

const HOUR_MS = 3_600_000;
const MIN_COMPARABLE_DAYS = 5;

function utcDayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function spanPct(candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  const low = Math.min(...candles.map((c) => c.low));
  const high = Math.max(...candles.map((c) => c.high));
  return low > 0 && high >= low ? ((high - low) / low) * 100 : null;
}

/** `hourly` must be 1h candles, oldest first, spanning several days. */
export function computeIntradayContext(
  hourly: Candle[],
  now: Date = new Date()
): IntradayContext | null {
  if (hourly.length === 0) return null;
  const nowMs = now.getTime();
  const todayKey = now.toISOString().slice(0, 10);

  const byDay = new Map<string, Candle[]>();
  for (const c of hourly) {
    const key = utcDayKey(c.ts);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(c);
    else byDay.set(key, [c]);
  }
  for (const bucket of byDay.values()) bucket.sort((a, b) => a.ts - b.ts);

  // Only hours that have finished count, on both sides of the comparison.
  const today = (byDay.get(todayKey) ?? []).filter((c) => c.ts + HOUR_MS <= nowMs);
  const elapsedHours = today.length;
  if (elapsedHours === 0) return null;

  const todayRangePct = spanPct(today);
  if (todayRangePct === null) return null;
  const todayVolume = today.reduce((sum, c) => sum + c.volume, 0);

  const priorWindows = [...byDay.entries()]
    .filter(([key, candles]) => key !== todayKey && candles.length >= elapsedHours)
    .map(([, candles]) => candles.slice(0, elapsedHours));
  if (priorWindows.length < MIN_COMPARABLE_DAYS) return null;

  const priorSpans = priorWindows.map(spanPct).filter((v): v is number => v !== null);
  if (priorSpans.length < MIN_COMPARABLE_DAYS) return null;
  const narrower = priorSpans.filter((v) => v < todayRangePct).length;

  const priorVolumes = priorWindows
    .map((w) => w.reduce((sum, c) => sum + c.volume, 0))
    .filter((v) => v > 0);
  const medianVolume = median(priorVolumes);

  return {
    elapsedHours,
    comparableDays: priorWindows.length,
    todayRangePct,
    rangePercentile: (narrower / priorSpans.length) * 100,
    volumeVsTypical:
      medianVolume !== null && medianVolume > 0 ? todayVolume / medianVolume : null,
  };
}

/** "4 hours" / "1 hour", for sentences that name the window. */
export function hoursLabel(hours: number): string {
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
