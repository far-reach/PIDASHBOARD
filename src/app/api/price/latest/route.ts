import { NextResponse, type NextRequest } from "next/server";
import { getLatestPrice } from "@/lib/feed";
import { SYMBOL } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/** GET /api/price/latest → { price, bid, ask, source, ts, staleness_s, ... } */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`price:${clientKey(req)}`, { capacity: 120, refillPerSec: 2 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  try {
    const latest = await getLatestPrice(SYMBOL);
    return NextResponse.json({
      symbol: latest.symbol,
      price: latest.price,
      bid: latest.bid,
      ask: latest.ask,
      volume_24h: latest.volume24h,
      change_pct_24h: latest.changePct24h,
      high_24h: latest.high24h,
      low_24h: latest.low24h,
      source: latest.source,
      is_failover: latest.isFailover,
      divergence_pct: latest.divergencePct,
      ts: latest.ts,
      staleness_s: latest.stalenessS,
      is_stale: latest.isStale,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "all price sources unavailable", detail: err instanceof Error ? err.message : "unknown" },
      { status: 503 }
    );
  }
}
