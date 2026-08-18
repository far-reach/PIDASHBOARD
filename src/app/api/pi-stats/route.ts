import { NextResponse, type NextRequest } from "next/server";
import { getPiStats } from "@/lib/pistats";
import { getAggregator } from "@/lib/market/aggregator";
import { buildBehaviorLine } from "@/lib/behavior";
import { computeIntradayContext } from "@/lib/intraday-context";
import { SYMBOL } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * GET /api/pi-stats
 *
 * Network-level figures for PI (supply, market cap, FDV, global volume) from
 * the cached CoinGecko aggregator, the app's own daily supply-snapshot
 * history, and the factual 24h behavior line computed from our candle data.
 * Everything is attributed and timestamped; nothing here is a projection.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`pistats:${clientKey(req)}`, { capacity: 60, refillPerSec: 1 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  const payload = await getPiStats();

  let behavior: string | null = null;
  try {
    const agg = getAggregator();
    const { candles } = await agg.collectCandles(SYMBOL, "1d", 30);
    // Hourly candles power the like-for-like comparison against the same
    // hours of prior days; 300 covers roughly twelve of them. If they are
    // unavailable the line falls back to the whole-day comparison.
    let intraday = null;
    try {
      const { candles: hourly } = await agg.collectCandles(SYMBOL, "1h", 300);
      intraday = computeIntradayContext(hourly);
    } catch {
      // Fall back silently; the daily path still produces a sentence.
    }
    // Venue agreement comes from the aggregator's own cross-check, which is
    // only meaningful when at least two venues answered recently; the line
    // omits the clause rather than inventing a comparison.
    const status = agg.feedStatus(null, false);
    const freshVenues = status.sources.filter((s) => s.ok).length;
    behavior = buildBehaviorLine({
      symbol: SYMBOL,
      daily: candles,
      intraday,
      divergencePct: status.divergencePct,
      venueCount: freshVenues,
    });
  } catch {
    // Candles unavailable: the line is simply omitted rather than guessed.
  }

  return NextResponse.json({
    ...payload,
    behavior,
    attribution: "Market data: CoinGecko, OKX, MEXC",
  });
}
