import { NextResponse, type NextRequest } from "next/server";
import { okx } from "@/lib/market/okx";
import { getCache } from "@/lib/cache";
import { SYMBOL } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/funding — perpetual funding rate for the symbol, when a perp is
 * listed. Returns { rate: null } rather than an error when there is no perp
 * market or the venue is unreachable: funding is context, never a hard
 * dependency of the dashboard.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`funding:${clientKey(req)}`, { capacity: 60, refillPerSec: 1 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const cache = await getCache();
  const cacheKey = `funding:${SYMBOL}`;
  const cached = await cache.get<object>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const funding = await okx.fetchFunding(SYMBOL);
  const body = {
    symbol: SYMBOL,
    rate: funding?.rate ?? null,
    next_funding_ts: funding?.nextFundingTs ?? null,
    source: funding?.source ?? null,
    as_of: new Date().toISOString(),
  };
  await cache.set(cacheKey, body, 60);
  return NextResponse.json(body);
}
