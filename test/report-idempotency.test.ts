import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { generateDailyReport } from "@/lib/reports/daily";
import { createTestDb } from "./helpers";

/**
 * Brief §Phase 1.5: exactly one report per (symbol, date); re-runs are no-ops.
 * A row is pre-inserted so generateDailyReport short-circuits before any
 * network fetch — this test runs fully offline.
 */
describe("daily report idempotency", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
    await db.query(
      `INSERT INTO daily_reports (symbol, report_date, open, high, low, close, change_pct, volume, content_md, data)
       VALUES ('PIUSDT', '2026-08-13', 0.5, 0.58, 0.48, 0.56, 12, 3000000, '# original content', '{}'::jsonb)`
    );
  });

  afterAll(async () => {
    await db.close();
  });

  it("re-running a date with an existing report returns it unchanged (created=false)", async () => {
    const first = await generateDailyReport("PIUSDT", "2026-08-13", db);
    expect(first.created).toBe(false);
    expect(first.report.contentMd).toBe("# original content");
    expect(first.report.close).toBe(0.56);

    const second = await generateDailyReport("PIUSDT", "2026-08-13", db);
    expect(second.created).toBe(false);
    expect(second.report.id).toBe(first.report.id);
  });

  it("the unique constraint makes concurrent duplicate inserts a no-op", async () => {
    await db.query(
      `INSERT INTO daily_reports (symbol, report_date, content_md)
       VALUES ('PIUSDT', '2026-08-13', 'attempted overwrite')
       ON CONFLICT (symbol, report_date) DO NOTHING`
    );
    const { rows } = await db.query<{ n: string; content_md: string }>(
      `SELECT count(*)::text AS n, min(content_md) AS content_md
       FROM daily_reports WHERE symbol = 'PIUSDT' AND report_date = '2026-08-13'`
    );
    expect(Number(rows[0]!.n)).toBe(1);
    expect(rows[0]!.content_md).toBe("# original content");
  });
});
