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

async function loop(): Promise<void> {
  log("info", "report scheduler starting", { hourUtc: reportHourUtc() });
  // Check every minute; generate when we're at HH:05+ UTC and the previous
  // day's report doesn't exist yet (idempotency makes the extra calls free).
  const tick = async () => {
    const now = new Date();
    if (now.getUTCHours() === reportHourUtc() && now.getUTCMinutes() >= 5) {
      try {
        await runOnce(previousUtcDate(now));
      } catch (err) {
        log("error", "scheduled generation failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
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
