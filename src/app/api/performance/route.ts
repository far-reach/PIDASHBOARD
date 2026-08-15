import { NextResponse, type NextRequest } from "next/server";
import { SYMBOL } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { listSignalsWithOutcomes } from "@/lib/signals/repo";
import { computePerformance } from "@/lib/signals/performance";
import { isAdminRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/performance — derived live from the immutable event log on every
 * request (brief §3.2). Public for everyone, always full-history: performance
 * transparency is never behind the paywall (brief §3.8).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`perf:${clientKey(req)}`, { capacity: 60, refillPerSec: 1 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const includeTest = isAdminRequest(req) && req.nextUrl.searchParams.get("include_test") === "1";
  // limit: null — performance is computed over the COMPLETE record. Capping it
  // would quietly drop the oldest signals and flatter the numbers over time.
  const signals = await listSignalsWithOutcomes({ symbol: SYMBOL, includeTest, limit: null });
  const summary = computePerformance(signals);
  return NextResponse.json({ performance: summary, symbol: SYMBOL });
}
