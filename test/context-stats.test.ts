import { describe, expect, it } from "vitest";
import { computeContextStats } from "@/lib/context-stats";
import type { Candle } from "@/lib/market/types";

/** A flat day: range low→high, volume as given. */
function day(ts: number, low: number, high: number, volume: number): Candle {
  return { ts, open: low, high, low, close: high, volume };
}

const DAY_MS = 86_400_000;

function series(days: { low: number; high: number; volume: number }[]): Candle[] {
  const start = Date.UTC(2026, 6, 1);
  return days.map((d, i) => day(start + i * DAY_MS, d.low, d.high, d.volume));
}

describe("computeContextStats", () => {
  const noonUtc = new Date(Date.UTC(2026, 6, 31, 12, 0, 0));

  it("returns null when there is not enough history", () => {
    const candles = series(Array.from({ length: 5 }, () => ({ low: 1, high: 1.1, volume: 100 })));
    expect(computeContextStats(candles, 1.05, noonUtc)).toBeNull();
  });

  it("computes range percentile against prior days only", () => {
    // 10 history days with 1% range, today with 5% range → wider than all of them.
    const history = Array.from({ length: 10 }, () => ({ low: 1, high: 1.01, volume: 100 }));
    const candles = series([...history, { low: 1, high: 1.05, volume: 50 }]);
    const stats = computeContextStats(candles, 1.02, noonUtc)!;
    expect(stats.historyDays).toBe(10);
    expect(stats.rangePercentile).toBe(100);
    expect(stats.todayRangePct).toBeCloseTo(5, 5);
  });

  it("reports volume as a ratio of the history median without projecting", () => {
    const history = Array.from({ length: 10 }, () => ({ low: 1, high: 1.01, volume: 100 }));
    const candles = series([...history, { low: 1, high: 1.01, volume: 50 }]);
    const stats = computeContextStats(candles, 1.005, noonUtc)!;
    // Half the median, stated as-is: no scaling by elapsed time.
    expect(stats.volumeVsMedian).toBeCloseTo(0.5, 5);
    expect(stats.dayElapsedPct).toBeCloseTo(50, 1);
  });

  it("places the current price inside the observed band", () => {
    const history = Array.from({ length: 10 }, () => ({ low: 1, high: 2, volume: 100 }));
    const candles = series([...history, { low: 1.4, high: 1.6, volume: 100 }]);
    const stats = computeContextStats(candles, 1.5, noonUtc)!;
    expect(stats.bandLow).toBe(1);
    expect(stats.bandHigh).toBe(2);
    expect(stats.pricePositionPct).toBeCloseTo(50, 5);
  });

  it("clamps a price outside the band instead of reporting >100%", () => {
    const history = Array.from({ length: 10 }, () => ({ low: 1, high: 2, volume: 100 }));
    const candles = series([...history, { low: 1.4, high: 1.6, volume: 100 }]);
    const stats = computeContextStats(candles, 2.5, noonUtc)!;
    expect(stats.pricePositionPct).toBe(100);
  });

  it("caps the comparison window at the requested history length", () => {
    const history = Array.from({ length: 60 }, () => ({ low: 1, high: 1.01, volume: 100 }));
    const candles = series([...history, { low: 1, high: 1.02, volume: 100 }]);
    const stats = computeContextStats(candles, 1.01, noonUtc, 30)!;
    expect(stats.historyDays).toBe(30);
  });
});
