import { describe, expect, it } from "vitest";
import { computePerformance } from "@/lib/signals/performance";
import { computeR } from "@/lib/signals/outcome";
import type { SignalWithOutcome } from "@/lib/signals/types";

/**
 * Brief §Phase 3 exit criteria: performance page numbers must match
 * hand-computed values across ≥ 20 signals with a mix of wins and losses.
 * The fixture below is exactly that — every expected value in the
 * assertions was computed by hand from the listed R values.
 */

function closed(
  i: number,
  r: number,
  closedAtIso: string,
  direction: "long" | "short" = "long"
): SignalWithOutcome {
  // entry 100, stop 90 (risk 10) → exit price reproducing the wanted R.
  const entry = 100;
  const stop = direction === "long" ? 90 : 110;
  const target = direction === "long" ? 120 : 80;
  const exitPrice = direction === "long" ? entry + r * 10 : entry - r * 10;
  return {
    id: `sig-${i}`,
    symbol: "PIUSDT",
    direction,
    entry,
    stop,
    target,
    rationale: "test",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: null,
    visibleFrom: null,
    source: "seed",
    isTest: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    events: [],
    status: r > 0 ? "hit_tp" : "hit_sl",
    r,
    exitPrice,
    closedAt: closedAtIso,
    filled: true,
    filledAt: "2026-01-01T00:00:00.000Z",
  };
}

function open(i: number): SignalWithOutcome {
  return { ...closed(i, 0, "2026-01-01T00:00:00.000Z"), status: "open", r: null, exitPrice: null, closedAt: null };
}

describe("computeR", () => {
  it("long: stop-out is -1R, target at 2x risk is +2R", () => {
    expect(computeR("long", 100, 90, 90)).toBe(-1);
    expect(computeR("long", 100, 90, 120)).toBe(2);
  });
  it("short: mirrored", () => {
    expect(computeR("short", 100, 110, 110)).toBe(-1);
    expect(computeR("short", 100, 110, 80)).toBe(2);
  });
  it("overshoot books more than -1R (slippage shows honestly)", () => {
    expect(computeR("long", 100, 90, 88)).toBeCloseTo(-1.2, 10);
  });
});

describe("computePerformance — hand-computed 22-signal fixture", () => {
  // Chronological R sequence (12 wins, 10 losses):
  //  +2, -1, +1.5, -1, -1, +3, +0.5, -1.2, +2, -1, +1, +2.5, -1, -0.8, +1.8,
  //  -1, +0.6, -1, +2.2, -1.1, +1.4, +0.9
  const rs = [2, -1, 1.5, -1, -1, 3, 0.5, -1.2, 2, -1, 1, 2.5, -1, -0.8, 1.8, -1, 0.6, -1, 2.2, -1.1, 1.4, 0.9];
  const signals: SignalWithOutcome[] = rs.map((r, i) =>
    closed(i, r, new Date(Date.UTC(2026, i < 8 ? 5 : i < 16 ? 6 : 7, (i % 8) + 1)).toISOString())
  );
  signals.push(open(100), open(101));

  const perf = computePerformance(signals, new Date("2026-08-14T00:00:00Z"));

  it("counts", () => {
    expect(perf.totalSignals).toBe(24);
    expect(perf.openSignals).toBe(2);
    expect(perf.closedSignals).toBe(22);
    expect(perf.scored).toBe(22);
    expect(perf.wins).toBe(12);
    expect(perf.losses).toBe(10);
  });

  it("win rate = 12/22 = 54.55%", () => {
    expect(perf.winRatePct).toBeCloseTo(54.55, 2);
  });

  it("sum R = 9.3 and avg R = 9.3/22 (hand-computed)", () => {
    // wins: 2+1.5+3+0.5+2+1+2.5+1.8+0.6+2.2+1.4+0.9 = 19.4
    // losses: 1+1+1+1.2+1+1+0.8+1+1+1.1 = 10.1 → net 9.3
    expect(perf.sumR).toBeCloseTo(9.3, 4);
    expect(perf.avgR).toBeCloseTo(9.3 / 22, 4);
  });

  it("best/worst R", () => {
    expect(perf.bestR).toBe(3);
    expect(perf.worstR).toBe(-1.2);
  });

  it("max drawdown = 2.0R (hand-computed from the running cumR trace)", () => {
    // Running cumR: 2, 1, 2.5, 1.5, 0.5, 3.5, 4, 2.8, 4.8, 3.8, 4.8, 7.3,
    //               6.3, 5.5, 7.3, 6.3, 6.9, 5.9, 8.1, 7, 8.4, 9.3
    // Drawdowns: peak 2.5 → trough 0.5 (2.0); 4 → 2.8 (1.2); 4.8 → 3.8 (1.0);
    // 7.3 → 5.5 (1.8); 7.3 → 5.9 (1.4); 8.1 → 7 (1.1). Max = 2.0R.
    expect(perf.maxDrawdownR).toBeCloseTo(2.0, 4);
  });

  it("current streak: last two closes are wins (+1.4, +0.9) after a loss → +2", () => {
    expect(perf.currentStreak).toBe(2);
  });

  it("equity curve ends at sum R and is monotonic in time", () => {
    expect(perf.equityCurve).toHaveLength(22);
    expect(perf.equityCurve[21]!.cumR).toBeCloseTo(9.3, 4);
    for (let i = 1; i < perf.equityCurve.length; i++) {
      expect(perf.equityCurve[i]!.ts >= perf.equityCurve[i - 1]!.ts).toBe(true);
    }
  });

  it("monthly rows partition the closed signals (8 + 8 + 6)", () => {
    expect(perf.monthly.map((m) => m.n)).toEqual([8, 8, 6]);
    const totalFromMonths = perf.monthly.reduce((a, m) => a + m.sumR, 0);
    expect(totalFromMonths).toBeCloseTo(9.3, 3);
  });

  it("histogram survives JSON round-trip with win/loss sides intact (no Infinity)", () => {
    const roundTripped = JSON.parse(JSON.stringify(perf.histogram)) as typeof perf.histogram;
    for (const bin of roundTripped) {
      expect(typeof bin.from).toBe("number");
      expect(typeof bin.to).toBe("number");
    }
    const topBin = roundTripped[roundTripped.length - 1]!;
    expect(topBin.to > 0).toBe(true); // "≥ 3R" must classify as a win-side bin
  });

  it("histogram counts sum to scored signals and losses get equal-resolution bins", () => {
    const total = perf.histogram.reduce((a, b) => a + b.count, 0);
    expect(total).toBe(22);
    const lossBins = perf.histogram.filter((b) => b.to <= 0);
    const winBins = perf.histogram.filter((b) => b.from >= 0);
    expect(lossBins.length).toBeGreaterThanOrEqual(5);
    expect(winBins.length).toBeGreaterThanOrEqual(5);
  });

  it("empty input → nulls, not fake zeros", () => {
    const empty = computePerformance([]);
    expect(empty.winRatePct).toBeNull();
    expect(empty.avgR).toBeNull();
    expect(empty.currentStreak).toBe(0);
  });
});
