import { NextResponse, type NextRequest } from "next/server";
import { okx } from "@/lib/market/okx";
import { mexc } from "@/lib/market/mexc";
import { bitget } from "@/lib/market/bitget";
import { getCache } from "@/lib/cache";
import { SYMBOL } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import type { Tick } from "@/lib/market/types";

export const dynamic = "force-dynamic";

interface VenueRow {
  source: string;
  price: number;
  bid: number | null;
  ask: number | null;
  spread_pct: number | null;
  volume_24h: number | null;
  ts: number;
}

function toRow(t: Tick): VenueRow {
  const spread =
    t.bid !== null && t.ask !== null && t.ask > 0 ? ((t.ask - t.bid) / t.ask) * 100 : null;
  return {
    source: t.source,
    price: t.price,
    bid: t.bid,
    ask: t.ask,
    spread_pct: spread,
    volume_24h: t.volume24h,
    ts: t.ts,
  };
}

/**
 * GET /api/microstructure; how the market trades right now, across venues.
 * Per-venue last price and spread, the widest pairwise divergence between
 * fresh quotes, and the recent settled funding history from the OKX perp.
 * Everything here is an observation with a source and timestamp; venues that
 * fail to answer are simply absent rather than faked.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`micro:${clientKey(req)}`, { capacity: 30, refillPerSec: 0.5 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const cache = await getCache();
  const cacheKey = `micro:${SYMBOL}`;
  const cached = await cache.get<object>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const [tickers, fundingHistory] = await Promise.all([
    Promise.allSettled([okx, mexc, bitget].map((c) => c.fetchTicker(SYMBOL))),
    okx.fetchFundingHistory(SYMBOL, 24),
  ]);

  const venues = tickers
    .filter((r): r is PromiseFulfilledResult<Tick> => r.status === "fulfilled")
    .map((r) => toRow(r.value));

  // Widest pairwise gap between venues, as a percentage of their midpoint.
  let divergencePct: number | null = null;
  for (let i = 0; i < venues.length; i++) {
    for (let j = i + 1; j < venues.length; j++) {
      const a = venues[i]!.price;
      const b = venues[j]!.price;
      const mid = (a + b) / 2;
      if (mid > 0) {
        const d = (Math.abs(a - b) / mid) * 100;
        if (divergencePct === null || d > divergencePct) divergencePct = d;
      }
    }
  }

  const body = {
    symbol: SYMBOL,
    venues,
    divergence_pct: divergencePct,
    funding_history: fundingHistory,
    as_of: new Date().toISOString(),
  };
  await cache.set(cacheKey, body, 60);
  return NextResponse.json(body);
}
