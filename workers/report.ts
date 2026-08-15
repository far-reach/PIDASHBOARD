/**
 * Daily report worker (brief §Phase 1.5-1.6).
 *   one-shot (default):        npm run worker:report            → yesterday (UTC)
 *   specific date:             npm run worker:report -- --date=2026-08-13
 *   long-running scheduler:    WORKER_LOOP=1 npm run worker:report
 *                              (fires at REPORT_HOUR_UTC:05 every day)
 * Generation is idempotent — re-runs on a date that already has a report are no-ops.
 */
import { createDb } from "../src/lib/db";
import { generateDailyReport, previousUtcDate } from "../src/lib/reports/daily";
import { reportHourUtc, SYMBOL } from "../src/lib/env";

const log = (level: "info" | "warn" | "error", msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }));

function argDate(): string | null {
  const arg = process.argv.find((a) => a.startsWith("--date="));
  if (!arg) return null;
  const date = arg.slice("--date=".length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`bad --date "${date}", expected YYYY-MM-DD`);
  }
  return date;
}

async function runOnce(date: string): Promise<void> {
  const db = await createDb();
  try {
    const { report, created } = await generateDailyReport(SYMBOL, date, db);
    log("info", created ? "report generated" : "report already existed (idempotent no-op)", {
      symbol: SYMBOL,
      date: report.reportDate,
      close: report.close,
      changePct: report.changePct,
    });
  } finally {
    await db.close();
  }
}

/** UTC date string N days before `from`. */
function utcDateMinus(from: Date, days: number): string {
  return new Date(from.getTime() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Generate the previous day AND backfill any recent day still missing.
 *
 * Without backfill a single outage (worker down, exchange unreachable at
 * 00:05) leaves a permanent hole in the archive, because the scheduler only
 * ever looks at yesterday. Generation is idempotent, so re-offering days that
 * already exist costs one indexed lookup each.
 */
async function runWithBackfill(now: Date, backfillDays: number): Promise<void> {
  for (let i = 1; i <= backfillDays; i++) {
    const date = utcDateMinus(now, i);
    try {
      await runOnce(date);
    } catch (err) {
      log("warn", "generation failed for date; will retry on a later run", {
        date,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function loop(): Promise<void> {
  const backfillDays = Number(process.env.REPORT_BACKFILL_DAYS ?? 7);
  log("info", "report scheduler starting", { hourUtc: reportHourUtc(), backfillDays });

  let lastRunDate: string | null = null;
  const tick = async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    // Fire once per day, at or after the configured hour:05 UTC.
    if (
      lastRunDate !== today &&
      now.getUTCHours() >= reportHourUtc() &&
      (now.getUTCHours() > reportHourUtc() || now.getUTCMinutes() >= 5)
    ) {
      lastRunDate = today;
      await runWithBackfill(now, backfillDays);
    }
  };
  await tick();
  setInterval(() => void tick(), 60_000);
}

const date = argDate();
if (process.env.WORKER_LOOP === "1" && !date) {
  loop().catch((err) => {
    log("error", "report worker crashed", { error: String(err) });
    process.exit(1);
  });
} else {
  runOnce(date ?? previousUtcDate())
    .then(() => process.exit(0))
    .catch((err) => {
      log("error", "report generation failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    });
}
