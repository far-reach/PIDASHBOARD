/**
 * The session summary in one plain-English sentence, for readers who would
 * rather not decode figures. It deliberately does NOT repeat what the hero,
 * the session strip and the context panel already display (change %, the
 * high-low range, the volume ratio). Instead it states the session's
 * character: how wide the day has been against its own recent history, how
 * busy, and whether the venues we track agree on the price.
 *
 * Strictly factual: no adjectives that imply a view ("bullish", "strong"),
 * no forecast, nothing the language guard would flag. It also never claims a
 * full day when the UTC day has only just begun, which the previous
 * "over the past 24 hours" wording did at 00:05 on a few minutes of data.
 */
import type { Candle } from "@/lib/market/types";
import type { IntradayContext } from "@/lib/intraday-context";
import { hoursLabel } from "@/lib/intraday-context";

export interface BehaviorInputs {
  symbol: string;
  /** Trailing daily candles, oldest first, including the current day. */
  daily: Candle[];
  /**
   * Like-for-like comparison against the same hours of prior days. When
   * present it is preferred over the whole-day comparison below, which
   * makes a young day look quiet as a matter of arithmetic.
   */
  intraday?: IntradayContext | null;
  /** Widest gap between venues right now, in percent, when known. */
  divergencePct?: number | null;
  /** How many venues that gap was measured across. */
  venueCount?: number;
  /** Defaults to now; injectable so the elapsed-day wording is testable. */
  now?: Date;
}

/** How far into the UTC day we are, 0..1. */
function dayElapsedFraction(now: Date): number {
  const ms = now.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.min(1, Math.max(0, ms / 86_400_000));
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function buildBehaviorLine(inp: BehaviorInputs): string | null {
  const { daily, intraday = null, divergencePct = null, venueCount = 0, now = new Date() } = inp;
  const day = daily[daily.length - 1];
  if (!day || day.low <= 0 || day.high < day.low) return null;

  const asset = inp.symbol.replace("USDT", "");
  const elapsed = dayElapsedFraction(now);

  // Preferred path: compare the day so far against the same hours of prior
  // days, so "quiet" means quiet rather than early.
  if (intraday) {
    const window = hoursLabel(intraday.elapsedHours);
    const p = intraday.rangePercentile;
    const rangeWord =
      p >= 75 ? "an unusually wide" : p <= 25 ? "a narrower than usual" : "a typical";
    const ratio = intraday.volumeVsTypical;
    const volumePart =
      ratio === null
        ? ""
        : ratio >= 1.5
          ? " on heavier trading than usual for this point in the day"
          : ratio >= 1.15
            ? " on busier trading than usual for this point in the day"
            : ratio <= 0.5
              ? " on much lighter trading than usual for this point in the day"
              : ratio <= 0.85
                ? " on lighter trading than usual for this point in the day"
                : " on ordinary trading volume for this point in the day";
    const sentence =
      `In the first ${window} of the UTC day ${asset} has held ${rangeWord} ` +
      `${intraday.todayRangePct.toFixed(1)}% band${volumePart}.`;
    return withVenues(sentence, divergencePct, venueCount);
  }

  // Under ~1 hour of data the day says nothing yet, and a confident sentence
  // about a handful of minutes would be worse than no sentence.
  if (elapsed < 0.04) {
    return `The UTC trading day has just begun, so ${asset} figures below cover only the minutes since midnight UTC.`;
  }
  const period = elapsed >= 0.95 ? "Today" : elapsed >= 0.5 ? "So far today" : "Early in the UTC day";

  const bandPct = ((day.high - day.low) / day.low) * 100;
  const prior = daily.slice(0, -1).slice(-30);

  // Range character, as a comparison against this venue's own history.
  let rangeWord = "has held a";
  if (prior.length >= 7) {
    const priorBands = prior
      .filter((c) => c.low > 0 && c.high >= c.low)
      .map((c) => ((c.high - c.low) / c.low) * 100);
    const med = median(priorBands);
    if (med !== null && med > 0) {
      const ratio = bandPct / med;
      rangeWord =
        ratio >= 1.5
          ? "has covered an unusually wide"
          : ratio <= 0.6
            ? "has held a narrow"
            : "has held a";
    }
  }

  let volumePart = "";
  if (prior.length >= 5) {
    const med = median(prior.map((c) => c.volume).filter((v) => v > 0));
    if (med !== null && med > 0) {
      const ratio = day.volume / med;
      volumePart =
        ratio >= 1.5
          ? " on heavier trading than usual"
          : ratio >= 1.15
            ? " on busier trading than usual"
            : ratio <= 0.5
              ? " on much lighter trading than usual"
              : ratio <= 0.85
                ? " on lighter trading than usual"
                : " on ordinary trading volume";
    }
  }

  const sentence = `${period} ${asset} ${rangeWord} ${bandPct.toFixed(1)}% band${volumePart}.`;
  return withVenues(sentence, divergencePct, venueCount);
}

/** Venue agreement is the one fact no other panel states in words. */
function withVenues(sentence: string, divergencePct: number | null, venueCount: number): string {
  if (divergencePct === null || venueCount < 2) return sentence;
  const agreement =
    divergencePct < 0.25
      ? `The ${venueCount} venues tracked agree to within ${divergencePct.toFixed(2)}%.`
      : `The ${venueCount} venues tracked differ by up to ${divergencePct.toFixed(2)}%, so the price depends on where you look.`;
  return `${sentence} ${agreement}`;
}
