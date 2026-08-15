import { NextResponse, type NextRequest } from "next/server";
import { generateDailyReport } from "@/lib/reports/daily";
import { SYMBOL } from "@/lib/env";
import { isCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled daily-report generation for serverless deployments (Vercel Cron
 * hits this at 00:05 UTC; see vercel.json). Generation is idempotent, so an
 * extra or retried invocation is a no-op rather than a duplicate report.
 * Deployments running the always-on worker do not need this endpoint.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const explicit = req.nextUrl.searchParams.get("date");
  if (explicit && !/^\d{4}-\d{2}-\d{2}$/.test(explicit)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  // Backfill recent days as well as yesterday: a single missed invocation
  // would otherwise leave a permanent hole in the archive. Generation is
  // idempotent, so days that already exist cost one indexed lookup.
  const backfillDays = explicit ? 0 : Number(process.env.REPORT_BACKFILL_DAYS ?? 7);
  const dates = explicit
    ? [explicit]
    : Array.from({ length: Math.max(1, backfillDays) }, (_, i) =>
        new Date(Date.now() - (i + 1) * 24 * 3600 * 1000).toISOString().slice(0, 10)
      );

  const results: { date: string; created?: boolean; error?: string }[] = [];
  for (const date of dates) {
    try {
      const { report, created } = await generateDailyReport(SYMBOL, date);
      results.push({ date: report.reportDate, created });
    } catch (err) {
      results.push({ date, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  const anySucceeded = results.some((r) => r.error === undefined);
  return NextResponse.json({ ok: anySucceeded, results }, { status: anySucceeded ? 200 : 500 });
}
