/**
 * The one-line description of the past 24 hours, computed from our own candle
 * data. Strictly factual: direction of the move, the range it happened in,
 * and how busy it was compared with the last 30 days. No adjectives that
 * imply a view ("bullish", "strong"), no forecast, nothing the language
 * guard would flag. The reader gets the day at a glance and draws their own
 * conclusion.
 */
import type { Candle } from "@/lib/market/types";

const fmt = (n: number, dp = 4): string => n.toFixed(dp);

export interface BehaviorInputs {
  symbol: string;
  /** Trailing daily candles, oldest first, including the current day. */
  daily: Candle[];
}

export function buildBehaviorLine(inp: BehaviorInputs): string | null {
  const { daily } = inp;
  const day = daily[daily.length - 1];
  if (!day || day.open <= 0) return null;

  const changePct = ((day.close - day.open) / day.open) * 100;
  const dir =
    changePct > 0.05
      ? `traded ${changePct.toFixed(2)}% higher`
      : changePct < -0.05
        ? `traded ${Math.abs(changePct).toFixed(2)}% lower`
        : "traded close to flat";

  let volumePart = "";
  const prior = daily.slice(0, -1);
  if (prior.length >= 5) {
    const avg = prior.reduce((a, c) => a + c.volume, 0) / prior.length;
    if (avg > 0) {
      const ratio = day.volume / avg;
      volumePart =
        ratio >= 1.5
          ? `, on volume well above its recent average`
          : ratio >= 1.15
            ? `, on volume above its recent average`
            : ratio <= 0.5
              ? `, on volume well below its recent average`
              : ratio <= 0.85
                ? `, on volume below its recent average`
                : `, on typical volume`;
    }
  }

  return (
    `Over the past 24 hours ${inp.symbol.replace("USDT", "")} ${dir}, ` +
    `moving between ${fmt(day.low)} and ${fmt(day.high)} USDT${volumePart}.`
  );
}
