import { NextResponse, type NextRequest } from "next/server";
import { getAggregator } from "@/lib/market/aggregator";
import { resolveOpenSignals } from "@/lib/signals/resolver";
import { SYMBOL } from "@/lib/env";
import { isCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled signal resolution + price snapshot for serverless deployments.
 *
 * IMPORTANT OPERATIONAL CAVEAT: cron granularity (5 min on Vercel) means a
 * price can cross a stop or target and revert between invocations, so a
 * signal may resolve at a later, worse price than a continuously-running
 * worker would record. The recorded price is always the real observed one,
 * so the record stays honest — but for production the always-on ingest
 * worker (npm run worker:ingest) is the recommended deployment.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const agg = getAggregator();
    const { tick, isFailover } = await agg.collectTick(SYMBOL);
    const resolutions = await resolveOpenSignals(tick);

    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    await db.query(
      `INSERT INTO price_snapshots (symbol, price, bid, ask, volume_24h, source, is_failover, ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        SYMBOL,
        tick.price,
        tick.bid,
        tick.ask,
        tick.volume24h,
        tick.source,
        isFailover,
        new Date(tick.ts).toISOString(),
      ]
    );

    return NextResponse.json({
      ok: true,
      price: tick.price,
      source: tick.source,
      is_failover: isFailover,
      resolved: resolutions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "resolve cycle failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
