import { NextResponse, type NextRequest } from "next/server";
import { SYMBOL } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { generateDailyReport, listReports, previousUtcDate } from "@/lib/reports/daily";
import { reportError } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * Self-healing archive: if yesterday's report is missing when someone asks
 * for the list, generate it inline instead of showing a hole. The scheduled
 * cron remains the primary writer; this makes the archive survive a cron
 * that is misconfigured (no CRON_SECRET) or skipped. Generation is
 * idempotent, and the attempt is throttled per process so a burst of
 * readers triggers one backfill, not one per request.
 */
let lastBackfillAttempt = 0;
const BACKFILL_MIN_INTERVAL_MS = 10 * 60 * 1000;

async function backfillYesterdayIfMissing(reportDates: Set<string>): Promise<boolean> {
  const yesterday = previousUtcDate();
  if (reportDates.has(yesterday)) return false;
  const now = Date.now();
  if (now - lastBackfillAttempt < BACKFILL_MIN_INTERVAL_MS) return false;
  lastBackfillAttempt = now;
  try {
    const { created } = await generateDailyReport(SYMBOL, yesterday);
    return created;
  } catch (err) {
    // Data source down; the next window retries. The list still renders.
    reportError("inline report backfill failed", err, { date: yesterday });
    return false;
  }
}

/** GET /api/reports?limit=30; newest first. Reports are public. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`reports:${clientKey(req)}`, { capacity: 60, refillPerSec: 1 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 30) || 30, 1), 90);
  let reports = await listReports(SYMBOL, limit);
  if (await backfillYesterdayIfMissing(new Set(reports.map((r) => r.reportDate)))) {
    reports = await listReports(SYMBOL, limit);
  }
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
