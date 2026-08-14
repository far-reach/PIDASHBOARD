import { NextResponse, type NextRequest } from "next/server";
import { getAggregator } from "@/lib/market/aggregator";
import { getCache } from "@/lib/cache";
import { SYMBOL } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import type { Timeframe } from "@/lib/market/types";

export const dynamic = "force-dynamic";

const TFS: Timeframe[] = ["1m", "5m", "1h", "1d"];
const CACHE_TTL: Record<Timeframe, number> = { "1m": 15, "5m": 30, "1h": 60, "1d": 300 };

/** GET /api/candles?tf=1m|5m|1h|1d&limit=300 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`candles:${clientKey(req)}`, { capacity: 60, refillPerSec: 1 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const tfParam = req.nextUrl.searchParams.get("tf") ?? "1h";
  const tf = TFS.includes(tfParam as Timeframe) ? (tfParam as Timeframe) : null;
  if (!tf) {
    return NextResponse.json({ error: `tf must be one of ${TFS.join(", ")}` }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 300) || 300, 10), 500);

  const cache = await getCache();
  const cacheKey = `candles:${SYMBOL}:${tf}:${limit}`;
  const cached = await cache.get<object>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const agg = getAggregator();
    const { candles, source, isFailover } = await agg.collectCandles(SYMBOL, tf, limit);
    const body = {
      symbol: SYMBOL,
      tf,
      source,
      is_failover: isFailover,
      as_of: new Date().toISOString(),
      candles,
    };
    await cache.set(cacheKey, body, CACHE_TTL[tf]);
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { error: "candle sources unavailable", detail: err instanceof Error ? err.message : "unknown" },
      { status: 503 }
    );
  }
}
