import { describe, expect, it } from "vitest";
import { buildReportContent, type ReportInputs } from "@/lib/reports/daily";
import type { Candle } from "@/lib/market/types";

const day = (ts: number, o: number, h: number, l: number, c: number, v: number): Candle => ({
  ts,
  open: o,
  high: h,
  low: l,
  close: c,
  volume: v,
});

const D = Date.UTC(2026, 7, 13); // 2026-08-13T00:00Z
const HOUR = 3600_000;

function inputs(overrides: Partial<ReportInputs> = {}): ReportInputs {
  const theDay = day(D, 0.5, 0.58, 0.48, 0.56, 3_000_000);
  return {
    date: "2026-08-13",
    symbol: "PIUSDT",
    day: theDay,
    prevDay: day(D - 24 * HOUR, 0.49, 0.52, 0.47, 0.5, 1_000_000),
    last7: [theDay],
    last30: [day(D - 48 * HOUR, 0.45, 0.5, 0.44, 0.49, 1_000_000), theDay],
    hours: [
      day(D + 3 * HOUR, 0.5, 0.53, 0.5, 0.53, 100), // +6% best hour
      day(D + 9 * HOUR, 0.53, 0.53, 0.5, 0.51, 100), // ~-3.8% worst hour
    ],
    fundingRate: 0.0005,
    source: "okx",
    ...overrides,
  };
}

describe("buildReportContent", () => {
  it("reports the hand-computed change percent and OHLC", () => {
    const { contentMd, data } = buildReportContent(inputs());
    // (0.56 - 0.50) / 0.50 = +12%
    expect(data.changePct).toBeCloseTo(12, 6);
    expect(contentMd).toContain("+12.00%");
    expect(contentMd).toContain("0.5800"); // high
    expect(contentMd).toContain("0.4800"); // low
    expect(contentMd).toContain("closed higher");
  });

  it("identifies the best and worst hour in UTC", () => {
    const { contentMd, data } = buildReportContent(inputs());
    expect(contentMd).toContain("03:00 UTC");
    expect(contentMd).toContain("09:00 UTC");
    expect((data.bestHour as { pct: number }).pct).toBeCloseTo(6, 5);
  });

  it("flags elevated volume vs the 30-day average", () => {
    const { data } = buildReportContent(inputs());
    // avg vol = (1,000,000 + 3,000,000)/2 = 2,000,000 → ratio 1.5 = elevated
    expect(data.volRatio).toBeCloseTo(1.5, 6);
    expect(data.volumeFlag).toBe("elevated");
  });

  it("describes positive funding as long-leaning, for context only", () => {
    const { contentMd } = buildReportContent(inputs());
    expect(contentMd).toContain("long-leaning");
    expect(contentMd).toContain("context only");
  });

  it("always carries the disclaimer line", () => {
    const { contentMd } = buildReportContent(inputs());
    expect(contentMd).toContain("Not financial advice");
  });

  it("degrades honestly when no candle exists for the date", () => {
    const { contentMd } = buildReportContent(inputs({ day: null, hours: [], fundingRate: null }));
    expect(contentMd).toContain("No daily candle was available");
    expect(contentMd).not.toContain("Derivatives context");
  });
});
