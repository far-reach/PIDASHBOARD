import { describe, expect, it } from "vitest";
import { buildBehaviorLine } from "@/lib/behavior";
import type { Candle } from "@/lib/market/types";

function candle(low: number, high: number, volume: number): Candle {
  return { ts: 0, open: low, close: high, high, low, volume };
}

/** 29 prior days with a 2.5% band and steady volume. */
const base = Array.from({ length: 29 }, () => candle(0.08, 0.082, 1_000_000));

// Mid-afternoon UTC: the day is well under way but not over.
const midday = new Date(Date.UTC(2026, 6, 15, 14, 0, 0));

describe("session summary line", () => {
  it("describes the day's band against the venue's own history", () => {
    const line = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.082, 1_000_000)],
      now: midday,
    })!;
    expect(line).toContain("PI");
    expect(line).toMatch(/2\.5% band/);
  });

  it("calls an unusually wide day wide, and a narrow day narrow", () => {
    const wide = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.09, 1_000_000)],
      now: midday,
    })!;
    expect(wide).toContain("unusually wide");

    const narrow = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.0801, 1_000_000)],
      now: midday,
    })!;
    expect(narrow).toContain("narrow");
  });

  it("notes heavier and lighter trading than usual", () => {
    const heavy = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.082, 2_000_000)],
      now: midday,
    })!;
    expect(heavy).toContain("heavier trading than usual");

    const light = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.082, 300_000)],
      now: midday,
    })!;
    expect(light).toContain("much lighter trading than usual");
  });

  it("does NOT claim a full day a few minutes after midnight UTC", () => {
    const justAfterMidnight = new Date(Date.UTC(2026, 6, 15, 0, 20, 0));
    const line = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.0805, 20_000)],
      now: justAfterMidnight,
    })!;
    expect(line).toMatch(/just begun/i);
    expect(line).not.toMatch(/24 hours/);
  });

  it("labels the period honestly as the day progresses", () => {
    const day = [...base, candle(0.08, 0.082, 1_000_000)];
    const early = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: day,
      now: new Date(Date.UTC(2026, 6, 15, 4, 0, 0)),
    })!;
    expect(early).toMatch(/^Early in the UTC day/);

    const late = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: day,
      now: new Date(Date.UTC(2026, 6, 15, 23, 30, 0)),
    })!;
    expect(late).toMatch(/^Today/);
  });

  it("states venue agreement when venues were compared", () => {
    const agree = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.082, 1_000_000)],
      divergencePct: 0.09,
      venueCount: 3,
      now: midday,
    })!;
    expect(agree).toContain("3 venues tracked agree to within 0.09%");

    const disagree = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.082, 1_000_000)],
      divergencePct: 1.4,
      venueCount: 2,
      now: midday,
    })!;
    expect(disagree).toContain("differ by up to 1.40%");
  });

  it("omits the venue clause rather than comparing a single venue with itself", () => {
    const line = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.082, 1_000_000)],
      divergencePct: 0.05,
      venueCount: 1,
      now: midday,
    })!;
    expect(line).not.toMatch(/venue/);
  });

  it("prefers the like-for-like intraday comparison when it is available", () => {
    const line = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.0801, 20_000)], // whole-day view: 'quiet'
      intraday: {
        elapsedHours: 3,
        comparableDays: 9,
        todayRangePct: 2.4,
        rangePercentile: 90, // but busy FOR THIS HOUR
        volumeVsTypical: 1.8,
      },
      now: midday,
    })!;
    expect(line).toContain("first 3 hours of the UTC day");
    expect(line).toContain("unusually wide");
    expect(line).toContain("heavier trading than usual for this point in the day");
    // The whole-day framing must not leak through.
    expect(line).not.toMatch(/^So far today/);
  });

  it("returns null rather than a made-up line when there is no candle", () => {
    expect(buildBehaviorLine({ symbol: "PIUSDT", daily: [] })).toBeNull();
    expect(buildBehaviorLine({ symbol: "PIUSDT", daily: [candle(0, 0, 0)] })).toBeNull();
  });

  it("never uses forecast or sentiment language", () => {
    const line = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.09, 3_000_000)],
      divergencePct: 0.1,
      venueCount: 3,
      now: midday,
    })!;
    for (const banned of [/bullish/i, /bearish/i, /predict/i, /expect/i, /will\b/i, /—/]) {
      expect(line).not.toMatch(banned);
    }
  });
});
