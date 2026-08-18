import { describe, expect, it } from "vitest";
import { computeIntradayContext } from "@/lib/intraday-context";
import type { Candle } from "@/lib/market/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function hour(ts: number, low: number, high: number, volume: number): Candle {
  return { ts, open: low, close: high, high, low, volume };
}

/**
 * `days` newest-last, each an array of per-hour {low, high, volume} starting
 * at 00:00 UTC. Day 0 is the oldest.
 */
function series(startUtc: number, days: { low: number; high: number; volume: number }[][]): Candle[] {
  const out: Candle[] = [];
  days.forEach((hours, d) => {
    hours.forEach((h, i) => out.push(hour(startUtc + d * DAY + i * HOUR, h.low, h.high, h.volume)));
  });
  return out;
}

const DAY0 = Date.UTC(2026, 6, 1);
const flatHour = { low: 1, high: 1.01, volume: 100 };

describe("computeIntradayContext", () => {
  it("compares today against the SAME hours of prior days, not whole days", () => {
    // 8 prior days, each 24 hours that widen through the day. Today: 3 hours
    // in, matching the prior days' first 3 hours exactly.
    const priorDay = Array.from({ length: 24 }, (_, i) => ({
      low: 1,
      high: i < 3 ? 1.01 : 1.2, // calm early, wild later
      volume: 100,
    }));
    const today = Array.from({ length: 3 }, () => ({ low: 1, high: 1.01, volume: 100 }));
    const candles = series(DAY0, [...Array.from({ length: 8 }, () => priorDay), today]);
    // 03:30 UTC on the 9th day: three whole hours have elapsed.
    const now = new Date(DAY0 + 8 * DAY + 3 * HOUR + 30 * 60_000);

    const ctx = computeIntradayContext(candles, now)!;
    expect(ctx.elapsedHours).toBe(3);
    expect(ctx.comparableDays).toBe(8);
    // Identical to every prior day's first three hours: not "quieter than
    // 100% of days", which a whole-day comparison would have reported.
    expect(ctx.rangePercentile).toBe(0);
    expect(ctx.todayRangePct).toBeCloseTo(1, 5);
    expect(ctx.volumeVsTypical).toBeCloseTo(1, 5);
  });

  it("reports a genuinely busy morning as busy", () => {
    const priorDay = Array.from({ length: 24 }, () => flatHour);
    const today = [
      { low: 1, high: 1.05, volume: 400 },
      { low: 1, high: 1.05, volume: 400 },
    ];
    const candles = series(DAY0, [...Array.from({ length: 8 }, () => priorDay), today]);
    const now = new Date(DAY0 + 8 * DAY + 2 * HOUR + 5 * 60_000);

    const ctx = computeIntradayContext(candles, now)!;
    expect(ctx.rangePercentile).toBe(100); // wider than every comparable day
    expect(ctx.volumeVsTypical).toBeCloseTo(4, 5); // 800 vs a 200 median
  });

  it("ignores the in-progress hour, so today is never made to look light", () => {
    const priorDay = Array.from({ length: 24 }, () => flatHour);
    // Today has two candles, but the second hour is still running.
    const today = [flatHour, flatHour];
    const candles = series(DAY0, [...Array.from({ length: 8 }, () => priorDay), today]);
    const now = new Date(DAY0 + 8 * DAY + HOUR + 20 * 60_000); // 01:20 UTC

    const ctx = computeIntradayContext(candles, now)!;
    expect(ctx.elapsedHours).toBe(1); // only 00:00-01:00 has finished
    expect(ctx.volumeVsTypical).toBeCloseTo(1, 5); // 100 vs 100, not 100 vs 200
  });

  it("returns null in the first hour rather than comparing a sliver of a day", () => {
    const priorDay = Array.from({ length: 24 }, () => flatHour);
    const candles = series(DAY0, [...Array.from({ length: 8 }, () => priorDay), [flatHour]]);
    const now = new Date(DAY0 + 8 * DAY + 25 * 60_000); // 00:25 UTC
    expect(computeIntradayContext(candles, now)).toBeNull();
  });

  it("returns null without enough comparable days", () => {
    const priorDay = Array.from({ length: 24 }, () => flatHour);
    const candles = series(DAY0, [...Array.from({ length: 3 }, () => priorDay), [flatHour, flatHour]]);
    const now = new Date(DAY0 + 3 * DAY + 2 * HOUR + 5 * 60_000);
    expect(computeIntradayContext(candles, now)).toBeNull();
  });

  it("only counts prior days that reached the same hour", () => {
    const fullDay = Array.from({ length: 24 }, () => flatHour);
    const shortDay = Array.from({ length: 2 }, () => flatHour); // a gap in the feed
    const today = Array.from({ length: 6 }, () => flatHour);
    const candles = series(DAY0, [
      ...Array.from({ length: 6 }, () => fullDay),
      shortDay,
      today,
    ]);
    const now = new Date(DAY0 + 7 * DAY + 6 * HOUR + 5 * 60_000);

    const ctx = computeIntradayContext(candles, now)!;
    expect(ctx.elapsedHours).toBe(6);
    expect(ctx.comparableDays).toBe(6); // the 2-hour day is excluded
  });
});
