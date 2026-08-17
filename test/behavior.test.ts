import { describe, expect, it } from "vitest";
import { buildBehaviorLine } from "@/lib/behavior";
import type { Candle } from "@/lib/market/types";

function candle(open: number, close: number, volume: number): Candle {
  return {
    ts: 0,
    open,
    close,
    high: Math.max(open, close) * 1.01,
    low: Math.min(open, close) * 0.99,
    volume,
  };
}

const base = Array.from({ length: 29 }, () => candle(0.08, 0.08, 1_000_000));

describe("24h behavior line", () => {
  it("describes an up day factually, with the range", () => {
    const line = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.0824, 1_000_000)],
    });
    expect(line).toContain("PI");
    expect(line).toContain("3.00% higher");
    expect(line).toMatch(/moving between [\d.]+ and [\d.]+ USDT/);
  });

  it("describes a down day with the same prominence as an up day", () => {
    const line = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.0776, 1_000_000)],
    });
    expect(line).toContain("3.00% lower");
  });

  it("calls a tiny move flat instead of manufacturing a direction", () => {
    const line = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.080008, 1_000_000)],
    });
    expect(line).toContain("close to flat");
  });

  it("notes unusually high and unusually low volume", () => {
    const high = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.081, 2_000_000)],
    });
    expect(high).toContain("well above its recent average");

    const low = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.081, 300_000)],
    });
    expect(low).toContain("well below its recent average");
  });

  it("returns null rather than a made-up line when there is no candle", () => {
    expect(buildBehaviorLine({ symbol: "PIUSDT", daily: [] })).toBeNull();
    expect(buildBehaviorLine({ symbol: "PIUSDT", daily: [candle(0, 0, 0)] })).toBeNull();
  });

  it("never uses forecast or sentiment language", () => {
    const line = buildBehaviorLine({
      symbol: "PIUSDT",
      daily: [...base, candle(0.08, 0.09, 3_000_000)],
    })!;
    for (const banned of [/bullish/i, /bearish/i, /predict/i, /expect/i, /will\b/i, /—/]) {
      expect(line).not.toMatch(banned);
    }
  });
});
