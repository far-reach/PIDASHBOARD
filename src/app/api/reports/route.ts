import { NextResponse, type NextRequest } from "next/server";
import { SYMBOL } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { listReports } from "@/lib/reports/daily";

export const dynamic = "force-dynamic";

/** GET /api/reports?limit=30 — newest first. Reports are public. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`reports:${clientKey(req)}`, { capacity: 60, refillPerSec: 1 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 30) || 30, 1), 90);
  const reports = await listReports(SYMBOL, limit);
  return NextResponse.json({
    reports: reports.map((r) => ({
      date: r.reportDate,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      change_pct: r.changePct,
      volume: r.volume,
      content_md: r.contentMd,
      generated_at: r.generatedAt,
    })),
    symbol: SYMBOL,
  });
}
