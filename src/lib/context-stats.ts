/**
 * "Today in context": descriptive statistics comparing the current UTC day
 * against the preceding daily candles. Every number here states what the
 * recorded data shows; nothing projects, extrapolates a full-day estimate,
 * or scores today as good or bad. See COMPLIANCE.md before adding anything
 * that looks like a forecast.
 */
import type { Candle } from "@/lib/market/types";

export interface ContextStats {
  /** Days of history behind the comparisons (excludes today). */
  historyDays: number;
  /** Today's high-low range so far, as % of today's low. */
  todayRangePct: number;
  /** Share of history days whose full-day range was NARROWER than today's so far, 0..100. */
  rangePercentile: number;
  /** Today's volume so far as a ratio of the history's full-day median (1 = equal). */
  volumeVsMedian: number | null;
  /** How much of the UTC day has elapsed, 0..100. */
  dayElapsedPct: number;
  /** Where the current price sits inside the observed high-low band, 0..100. */
  pricePositionPct: number | null;
  /** The band's bounds. */
  bandLow: number;
  bandHigh: number;
}

const MIN_HISTORY_DAYS = 7;

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function rangePct(c: Candle): number | null {
  return c.low > 0 && c.high >= c.low ? ((c.high - c.low) / c.low) * 100 : null;
}

/**
 * `candles` must be daily, oldest first, with the final entry being the
 * current (incomplete) UTC day; that is what the exchange candle endpoints
 * return. `historyDays` caps the comparison window (default 30).
 */
export function computeContextStats(
  candles: Candle[],
  currentPrice: number | null,
  now: Date = new Date(),
  historyDays = 30
): ContextStats | null {
  if (candles.length < MIN_HISTORY_DAYS + 1) return null;
  const today = candles[candles.length - 1]!;
  const history = candles.slice(0, -1).slice(-historyDays);
  if (history.length < MIN_HISTORY_DAYS) return null;

  const todayRange = rangePct(today);
  if (todayRange === null) return null;

  const historyRanges = history
    .map(rangePct)
    .filter((r): r is number => r !== null);
  if (historyRanges.length < MIN_HISTORY_DAYS) return null;
  const narrower = historyRanges.filter((r) => r < todayRange).length;
  const rangePercentile = (narrower / historyRanges.length) * 100;

  const historyVolMedian = median(history.map((c) => c.volume).filter((v) => v > 0));
  const volumeVsMedian =
    historyVolMedian !== null && historyVolMedian > 0 && today.volume >= 0
      ? today.volume / historyVolMedian
      : null;

  const msIntoDay =
    now.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayElapsedPct = Math.min(100, Math.max(0, (msIntoDay / 86_400_000) * 100));

  const bandLow = Math.min(...history.map((c) => c.low), today.low);
  const bandHigh = Math.max(...history.map((c) => c.high), today.high);
  const pricePositionPct =
    currentPrice !== null && bandHigh > bandLow
      ? Math.min(100, Math.max(0, ((currentPrice - bandLow) / (bandHigh - bandLow)) * 100))
      : null;

  return {
    historyDays: history.length,
    todayRangePct: todayRange,
    rangePercentile,
    volumeVsMedian,
    dayElapsedPct,
    pricePositionPct,
    bandLow,
    bandHigh,
  };
}
