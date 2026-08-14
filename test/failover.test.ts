import { describe, expect, it } from "vitest";
import { Aggregator } from "@/lib/market/aggregator";
import type { ExchangeClient, Tick } from "@/lib/market/types";

function fakeClient(
  id: "okx" | "mexc" | "bitget",
  behavior: () => Promise<number>
): ExchangeClient {
  return {
    id,
    async fetchTicker(symbol: string): Promise<Tick> {
      const price = await behavior();
      return {
        symbol,
        price,
        bid: price - 0.001,
        ask: price + 0.001,
        volume24h: 1e6,
        changePct24h: 1,
        high24h: price * 1.05,
        low24h: price * 0.95,
        source: id,
        ts: Date.now(),
      };
    },
    async fetchCandles() {
      const price = await behavior();
      return [{ ts: Date.now(), open: price, high: price, low: price, close: price, volume: 1 }];
    },
  };
}

describe("aggregator failover (brief §3.6)", () => {
  it("serves the primary when healthy, unflagged", async () => {
    const agg = new Aggregator(
      [fakeClient("okx", async () => 0.5), fakeClient("mexc", async () => 0.51)],
      null
    );
    const { tick, isFailover } = await agg.collectTick("PIUSDT");
    expect(tick.source).toBe("okx");
    expect(isFailover).toBe(false);
  });

  it("promotes the secondary and flags failover when the primary throws", async () => {
    const agg = new Aggregator(
      [
        fakeClient("okx", async () => {
          throw new Error("okx down");
        }),
        fakeClient("mexc", async () => 0.51),
      ],
      null
    );
    const { tick, isFailover, status } = await agg.collectTick("PIUSDT");
    expect(tick.source).toBe("mexc");
    expect(isFailover).toBe(true);
    const okxHealth = status.sources.find((s) => s.id === "okx");
    expect(okxHealth?.ok).toBe(false);
    expect(okxHealth?.lastError).toContain("okx down");
  });

  it("recovers to the primary once it answers again", async () => {
    let okxUp = false;
    const agg = new Aggregator(
      [
        fakeClient("okx", async () => {
          if (!okxUp) throw new Error("okx down");
          return 0.5;
        }),
        fakeClient("mexc", async () => 0.51),
      ],
      null
    );
    const first = await agg.collectTick("PIUSDT");
    expect(first.tick.source).toBe("mexc");
    okxUp = true;
    const second = await agg.collectTick("PIUSDT");
    expect(second.tick.source).toBe("okx");
    expect(second.isFailover).toBe(false);
  });

  it("throws only when every feed source fails", async () => {
    const agg = new Aggregator(
      [
        fakeClient("okx", async () => {
          throw new Error("down");
        }),
        fakeClient("mexc", async () => {
          throw new Error("down");
        }),
      ],
      null
    );
    await expect(agg.collectTick("PIUSDT")).rejects.toThrow(/all price sources failed/);
  });

  it("prefers a fresh pushed (websocket) tick over a REST call", async () => {
    let restCalls = 0;
    const agg = new Aggregator(
      [
        fakeClient("okx", async () => {
          restCalls++;
          return 0.5;
        }),
      ],
      null
    );
    agg.pushTick({
      symbol: "PIUSDT",
      price: 0.499,
      bid: null,
      ask: null,
      volume24h: null,
      changePct24h: null,
      high24h: null,
      low24h: null,
      source: "okx",
      ts: Date.now(),
    });
    const { tick } = await agg.collectTick("PIUSDT");
    expect(tick.price).toBe(0.499);
    expect(restCalls).toBe(0);
  });

  it("computes divergence between the two feed sources", async () => {
    const agg = new Aggregator(
      [fakeClient("okx", async () => 0.5), fakeClient("mexc", async () => 0.51)],
      null
    );
    await agg.collectTick("PIUSDT"); // records okx
    // force the secondary to be polled too
    const mexcTick = await agg["feedSources"][1]!.fetchTicker("PIUSDT");
    agg.pushTick(mexcTick);
    const d = agg.divergencePct();
    // |0.5 - 0.51| / 0.505 ≈ 1.98%
    expect(d).toBeCloseTo(1.98, 1);
    expect(agg.isDiverged()).toBe(true);
  });
});
