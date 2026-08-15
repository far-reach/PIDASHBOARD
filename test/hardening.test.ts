import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { requirePrice, optionalNumber } from "@/lib/market/http";
import { Aggregator } from "@/lib/market/aggregator";
import { buildHistogram } from "@/lib/signals/performance";
import { newSignalSchema, BACKDATE_TOLERANCE_MS } from "@/lib/signals/schema";
import { activateSubscription, upsertUser } from "@/lib/users";
import { deriveOutcome } from "@/lib/signals/outcome";
import type { ExchangeClient, Tick } from "@/lib/market/types";
import type { SignalEventRow, SignalRow } from "@/lib/signals/types";
import { createTestDb } from "./helpers";

/**
 * Regression tests for defects found in the pre-publication review.
 * Each block names the failure it prevents from returning.
 */

describe("exchange price validation (a zero tick would stop out every open long)", () => {
  it("rejects zero, empty, null and NaN prices", () => {
    for (const bad of [0, "0", "", null, undefined, "abc", -1, Infinity]) {
      expect(() => requirePrice(bad, "test")).toThrow(/implausible price/);
    }
  });

  it("accepts genuine prices in string or number form", () => {
    expect(requirePrice("0.4213", "test")).toBeCloseTo(0.4213, 10);
    expect(requirePrice(1.5, "test")).toBe(1.5);
  });

  it("optionalNumber degrades to null instead of throwing", () => {
    expect(optionalNumber("")).toBeNull();
    expect(optionalNumber("0")).toBeNull();
    expect(optionalNumber(null)).toBeNull();
    expect(optionalNumber("1.25")).toBe(1.25);
  });

  it("a venue returning a zero last price fails over instead of serving 0", async () => {
    const bad: ExchangeClient = {
      id: "okx",
      async fetchTicker(symbol) {
        return { ...tickFor(symbol, 0), source: "okx" } as Tick;
      },
      async fetchCandles() {
        return [];
      },
    };
    // Simulate the real client's guard: a zero price throws before leaving it.
    const guarded: ExchangeClient = {
      ...bad,
      async fetchTicker(symbol) {
        const t = await bad.fetchTicker(symbol);
        requirePrice(t.price, "okx");
        return t;
      },
    };
    const good: ExchangeClient = {
      id: "mexc",
      async fetchTicker(symbol) {
        return { ...tickFor(symbol, 0.42), source: "mexc" } as Tick;
      },
      async fetchCandles() {
        return [];
      },
    };
    const agg = new Aggregator([guarded, good], null);
    const { tick, isFailover } = await agg.collectTick("PIUSDT");
    expect(tick.price).toBe(0.42);
    expect(tick.source).toBe("mexc");
    expect(isFailover).toBe(true);
  });
});

function tickFor(symbol: string, price: number): Tick {
  return {
    symbol,
    price,
    bid: null,
    ask: null,
    volume24h: null,
    changePct24h: null,
    high24h: null,
    low24h: null,
    source: "okx",
    ts: Date.now(),
  };
}

describe("cross-venue divergence actually runs", () => {
  it("polls the non-serving venue so divergence is computable", async () => {
    const mk = (id: "okx" | "mexc", price: number): ExchangeClient => ({
      id,
      async fetchTicker(symbol) {
        return { ...tickFor(symbol, price), source: id };
      },
      async fetchCandles() {
        return [];
      },
    });
    const agg = new Aggregator([mk("okx", 0.5), mk("mexc", 0.51)], null);
    await agg.collectTick("PIUSDT");
    // The secondary is refreshed in the background; give the microtask a turn.
    await new Promise((r) => setTimeout(r, 50));
    const d = agg.divergencePct();
    expect(d).not.toBeNull();
    expect(d!).toBeCloseTo(1.98, 1);
  });
});

describe("histogram never paints a catastrophic loss as the best outcome", () => {
  it("classifies an extreme loss into the lowest bin, not the top one", () => {
    const bins = buildHistogram([-1500]);
    expect(bins[0]!.count).toBe(1);
    expect(bins[bins.length - 1]!.count).toBe(0);
  });

  it("classifies an extreme win into the top bin", () => {
    const bins = buildHistogram([1500]);
    expect(bins[bins.length - 1]!.count).toBe(1);
    expect(bins[0]!.count).toBe(0);
  });
});

describe("publication timestamps cannot be quietly backdated", () => {
  const base = {
    symbol: "PIUSDT",
    direction: "long" as const,
    entry: 0.5,
    stop: 0.45,
    target: 0.6,
    rationale: "our model shows a support retest",
  };

  it("rejects an issued_at well in the past", () => {
    const old = new Date(Date.now() - BACKDATE_TOLERANCE_MS - 60_000).toISOString();
    const res = newSignalSchema.safeParse({ ...base, issued_at: old });
    expect(res.success).toBe(false);
  });

  it("allows small clock skew", () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    expect(newSignalSchema.safeParse({ ...base, issued_at: recent }).success).toBe(true);
  });

  it("rejects an issued_at far in the future", () => {
    const far = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    expect(newSignalSchema.safeParse({ ...base, issued_at: far }).success).toBe(false);
  });
});

describe("unfilled signals are never scored", () => {
  const signal: SignalRow = {
    id: "s1",
    symbol: "PIUSDT",
    direction: "long",
    entry: 0.5,
    stop: 0.45,
    target: 0.6,
    rationale: "x",
    issuedAt: "2026-08-01T00:00:00.000Z",
    expiresAt: null,
    visibleFrom: null,
    source: "manual",
    isTest: true,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
  const ev = (type: SignalEventRow["type"], price: number | null): SignalEventRow => ({
    id: `${type}`,
    signalId: "s1",
    type,
    price,
    priceSource: "okx",
    note: "",
    occurredAt: "2026-08-02T00:00:00.000Z",
  });

  it("expiring without a fill yields r = null", () => {
    const o = deriveOutcome(signal, [ev("published", null), ev("expired", 0.58)]);
    expect(o.filled).toBe(false);
    expect(o.r).toBeNull();
  });

  it("expiring after a fill IS scored", () => {
    const o = deriveOutcome(signal, [ev("published", null), ev("filled", 0.5), ev("expired", 0.55)]);
    expect(o.filled).toBe(true);
    expect(o.r).toBeCloseTo(1, 6);
  });

  it("a target hit implies a fill, so historical records stay scored", () => {
    const o = deriveOutcome(signal, [ev("published", null), ev("hit_tp", 0.6)]);
    expect(o.filled).toBe(true);
    expect(o.r).toBeCloseTo(2, 6);
  });
});

describe("payment replay cannot buy two subscription periods", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
    await upsertUser("pi-user-1", "pioneer", db);
  });
  afterAll(async () => {
    await db.close();
  });

  it("crediting the same payment id twice grants exactly one period", async () => {
    const first = await activateSubscription("pi-user-1", "payment-abc", db);
    expect(first.alreadyCredited).toBe(false);

    const second = await activateSubscription("pi-user-1", "payment-abc", db);
    expect(second.alreadyCredited).toBe(true);
    expect(second.expiresAt).toBe(first.expiresAt);

    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM subscriptions WHERE pi_user_id = 'pi-user-1'`
    );
    expect(Number(rows[0]!.n)).toBe(1);
  });

  it("a genuinely different payment extends the subscription", async () => {
    const extended = await activateSubscription("pi-user-1", "payment-def", db);
    expect(extended.alreadyCredited).toBe(false);
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM subscriptions WHERE pi_user_id = 'pi-user-1'`
    );
    expect(Number(rows[0]!.n)).toBe(2);
  });
});

describe("the append-only tables reject TRUNCATE, not just row mutations", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db.close();
  });

  it("TRUNCATE signal_events is refused", async () => {
    await expect(db.query(`TRUNCATE signal_events`)).rejects.toThrow(/append-only/i);
  });

  it("TRUNCATE signals is refused", async () => {
    await expect(db.query(`TRUNCATE signals CASCADE`)).rejects.toThrow(/append-only/i);
  });
});
