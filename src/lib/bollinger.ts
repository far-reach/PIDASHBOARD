/**
 * Bollinger Bands: a 20-period simple moving average of closes with an
 * envelope at ±2 standard deviations. Purely descriptive statistics drawn
 * from observed candles; the chart labels them as what they are and nothing
 * here recommends acting on them.
 */
import type { Candle } from "@/lib/market/types";

export interface BollingerPoint {
  ts: number;
  middle: number;
  upper: number;
  lower: number;
}

export function computeBollinger(candles: Candle[], period = 20, mult = 2): BollingerPoint[] {
  if (candles.length < period) return [];
  const out: BollingerPoint[] = [];
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!.close;
    sum += c;
    sumSq += c * c;
    if (i >= period) {
      const gone = candles[i - period]!.close;
      sum -= gone;
      sumSq -= gone * gone;
    }
    if (i >= period - 1) {
      const mean = sum / period;
      const variance = Math.max(0, sumSq / period - mean * mean);
      const sd = Math.sqrt(variance);
      out.push({
        ts: candles[i]!.ts,
        middle: mean,
        upper: mean + mult * sd,
        lower: mean - mult * sd,
      });
    }
  }
  return out;
}
