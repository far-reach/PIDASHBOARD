import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import type { Tick } from "@/lib/market/types";
import { createSignal, getSignalWithOutcome } from "@/lib/signals/repo";
import { resolveOpenSignals } from "@/lib/signals/resolver";
import { fillsAtPrice, resolveAgainstPrice } from "@/lib/signals/outcome";
import { createTestDb } from "./helpers";

const tick = (price: number, ts = Date.now()): Tick => ({
  symbol: "PIUSDT",
  price,
  bid: price - 0.001,
  ask: price + 0.001,
  volume24h: 1e6,
  changePct24h: 0,
  high24h: price * 1.1,
  low24h: price * 0.9,
  source: "okx",
  ts,
});

describe("resolveAgainstPrice (pure rules)", () => {
  const long = { direction: "long" as const, stop: 0.45, target: 0.6 };
  const short = { direction: "short" as const, stop: 0.55, target: 0.4 };

  it("long resolves at boundaries", () => {
    expect(resolveAgainstPrice(long, 0.5)).toBeNull();
    expect(resolveAgainstPrice(long, 0.45)).toBe("hit_sl");
    expect(resolveAgainstPrice(long, 0.6)).toBe("hit_tp");
  });
  it("short resolves at boundaries", () => {
    expect(resolveAgainstPrice(short, 0.5)).toBeNull();
    expect(resolveAgainstPrice(short, 0.55)).toBe("hit_sl");
    expect(resolveAgainstPrice(short, 0.4)).toBe("hit_tp");
  });
  it("a price satisfying both books the LOSS (conservative)", () => {
    // degenerate wide tick: stop checked before target
    expect(resolveAgainstPrice({ direction: "long", stop: 0.5, target: 0.5 }, 0.5)).toBe("hit_sl");
  });
});

describe("fillsAtPrice (limit-order semantics)", () => {
  it("long fills at or below entry only", () => {
    expect(fillsAtPrice({ direction: "long", entry: 0.5 }, 0.5)).toBe(true);
    expect(fillsAtPrice({ direction: "long", entry: 0.5 }, 0.49)).toBe(true);
    expect(fillsAtPrice({ direction: "long", entry: 0.5 }, 0.51)).toBe(false);
  });
  it("short fills at or above entry only", () => {
    expect(fillsAtPrice({ direction: "short", entry: 0.5 }, 0.5)).toBe(true);
    expect(fillsAtPrice({ direction: "short", entry: 0.5 }, 0.51)).toBe(true);
    expect(fillsAtPrice({ direction: "short", entry: 0.5 }, 0.49)).toBe(false);
  });
});

describe("resolveOpenSignals against the real schema", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db.close();
  });

  const newSignal = (over: Partial<Parameters<typeof createSignal>[0]> = {}) =>
    createSignal(
      {
        symbol: "PIUSDT",
        direction: "long",
        entry: 0.5,
        stop: 0.45,
        target: 0.6,
        rationale: "resolver test",
        isTest: true,
        ...over,
      },
      db
    );

  it("fills when the entry level trades, without closing", async () => {
    const s = await newSignal();
    const results = await resolveOpenSignals(tick(0.5), db);
    expect(results.find((r) => r.signalId === s.id)?.type).toBe("filled");
    const stored = await getSignalWithOutcome(s.id, db);
    expect(stored?.status).toBe("open");
    expect(stored?.filled).toBe(true);
  });

  it("writes hit_tp with the triggering price + source, exactly once, after filling", async () => {
    const s = await newSignal();
    await resolveOpenSignals(tick(0.5), db); // fill at entry
    const results = await resolveOpenSignals(tick(0.61), db);
    const mine = results.find((r) => r.signalId === s.id);
    expect(mine?.type).toBe("hit_tp");

    // Second pass: already closed, no duplicate event, no crash.
    const again = await resolveOpenSignals(tick(0.62), db);
    expect(again.find((r) => r.signalId === s.id)).toBeUndefined();

    const stored = await getSignalWithOutcome(s.id, db);
    expect(stored?.status).toBe("hit_tp");
    expect(stored?.exitPrice).toBe(0.61);
    expect(stored?.r).toBeCloseTo((0.61 - 0.5) / 0.05, 4);
    expect(stored?.events.filter((e) => e.type === "hit_tp")).toHaveLength(1);
    expect(stored?.events.filter((e) => e.type === "filled")).toHaveLength(1);
    expect(stored?.events.find((e) => e.type === "hit_tp")?.priceSource).toBe("okx");
  });

  it("writes hit_sl on stop breach for shorts, after filling", async () => {
    const s = await newSignal({ direction: "short", entry: 0.5, stop: 0.55, target: 0.4 });
    await resolveOpenSignals(tick(0.5), db); // short fills at or above entry
    await resolveOpenSignals(tick(0.56), db);
    const stored = await getSignalWithOutcome(s.id, db);
    expect(stored?.status).toBe("hit_sl");
    expect(stored?.r).toBeCloseTo((0.5 - 0.56) / 0.05, 4);
  });

  it("NEVER books a win when the entry level never traded (instant-win exploit)", async () => {
    // A long entered at 0.50 with a 0.60 target, published while the market is
    // already at 0.65: the target is 'reached' but no position could exist.
    const s = await newSignal();
    const results = await resolveOpenSignals(tick(0.65), db);
    expect(results.find((r) => r.signalId === s.id)).toBeUndefined();

    const stored = await getSignalWithOutcome(s.id, db);
    expect(stored?.status).toBe("open");
    expect(stored?.filled).toBe(false);
    expect(stored?.r).toBeNull();
  });

  it("expires an unfilled signal WITHOUT scoring it", async () => {
    const s = await newSignal({
      issuedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      expiresAt: new Date(Date.now() - 3600_000).toISOString(),
    });
    await resolveOpenSignals(tick(0.9), db); // far above entry: never fills
    const stored = await getSignalWithOutcome(s.id, db);
    expect(stored?.status).toBe("expired");
    expect(stored?.filled).toBe(false);
    expect(stored?.r).toBeNull(); // unscored — it was never a position
    expect(stored?.events.find((e) => e.type === "expired")?.note).toMatch(/not scored/i);
  });

  it("a filled signal that expires IS scored at the market price", async () => {
    const s = await newSignal({
      issuedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    await resolveOpenSignals(tick(0.5), db); // fills
    // Re-publish expiry in the past by advancing the tick clock beyond it.
    await resolveOpenSignals(tick(0.52, Date.now() + 2 * 3600_000), db);
    const stored = await getSignalWithOutcome(s.id, db);
    expect(stored?.status).toBe("expired");
    expect(stored?.filled).toBe(true);
    expect(stored?.r).toBeCloseTo((0.52 - 0.5) / 0.05, 4);
  });

  it("ignores signals issued in the future (scheduled)", async () => {
    const s = await newSignal({
      issuedAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    await resolveOpenSignals(tick(0.7), db);
    const stored = await getSignalWithOutcome(s.id, db);
    expect(stored?.status).toBe("open");
  });
});
