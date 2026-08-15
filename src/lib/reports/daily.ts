/**
 * Daily report generator (brief §Phase 1.5): idempotent — for a given
 * (symbol, UTC date) exactly one row ever exists; re-runs are no-ops.
 * Content is computed deterministically from market data and written in
 * model-based, conditional language (brief §2.3 — never advice).
 */
import { getDb, toIso, toNumOrNull, type Db } from "@/lib/db";
import { getAggregator } from "@/lib/market/aggregator";
import { okx } from "@/lib/market/okx";
import type { Candle } from "@/lib/market/types";

export interface DailyReport {
  id: string;
  symbol: string;
  reportDate: string; // YYYY-MM-DD (UTC)
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  changePct: number | null;
  volume: number | null;
  contentMd: string;
  data: Record<string, unknown>;
  generatedAt: string;
}

function mapReport(row: Record<string, unknown>): DailyReport {
  const rawDate = row.report_date;
  // node-postgres parses a `date` column into a Date at LOCAL midnight, so
  // toISOString() would shift it to the previous day on any host east of UTC.
  // Read the local calendar fields instead — they are the stored date.
  const reportDate =
    rawDate instanceof Date
      ? `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, "0")}-${String(
          rawDate.getDate()
        ).padStart(2, "0")}`
      : String(rawDate).slice(0, 10);
  return {
    id: String(row.id),
    symbol: String(row.symbol),
    reportDate,
    open: toNumOrNull(row.open),
    high: toNumOrNull(row.high),
    low: toNumOrNull(row.low),
    close: toNumOrNull(row.close),
    changePct: toNumOrNull(row.change_pct),
    volume: toNumOrNull(row.volume),
    contentMd: String(row.content_md),
    data: (typeof row.data === "string" ? JSON.parse(row.data) : row.data ?? {}) as Record<
      string,
      unknown
    >,
    generatedAt: toIso(row.generated_at),
  };
}

export function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Yesterday in UTC — the default report target. */
export function previousUtcDate(now: Date = new Date()): string {
  return utcDateString(new Date(now.getTime() - 24 * 3600 * 1000));
}

const fmt = (n: number | null | undefined, dp = 4): string =>
  n === null || n === undefined || !Number.isFinite(n) ? "n/a" : n.toFixed(dp);

/** Compact quantity, unit-agnostic (the caller states the unit). */
const fmtQty = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n)
    ? "n/a"
    : n >= 1e9
      ? `${(n / 1e9).toFixed(2)}B`
      : n >= 1e6
        ? `${(n / 1e6).toFixed(2)}M`
        : n >= 1e3
          ? `${(n / 1e3).toFixed(1)}K`
          : n.toFixed(2);

export interface ReportInputs {
  date: string;
  symbol: string;
  day: Candle | null; // the day's daily candle
  prevDay: Candle | null;
  last7: Candle[]; // trailing daily candles incl. the day
  last30: Candle[];
  hours: Candle[]; // the day's 1h candles
  fundingRate: number | null;
  source: string;
}

/** Pure content builder — unit-testable without network or DB. */
export function buildReportContent(inp: ReportInputs): {
  contentMd: string;
  data: Record<string, unknown>;
} {
  const { day, prevDay, last7, last30, hours } = inp;

  const changePct =
    day && day.open > 0 ? ((day.close - day.open) / day.open) * 100 : null;

  // Biggest single-hour move of the day.
  let bestHour: { ts: number; pct: number } | null = null;
  let worstHour: { ts: number; pct: number } | null = null;
  for (const h of hours) {
    if (h.open <= 0) continue;
    const pct = ((h.close - h.open) / h.open) * 100;
    if (!bestHour || pct > bestHour.pct) bestHour = { ts: h.ts, pct };
    if (!worstHour || pct < worstHour.pct) worstHour = { ts: h.ts, pct };
  }

  const hi7 = last7.length > 0 ? Math.max(...last7.map((c) => c.high)) : null;
  const lo7 = last7.length > 0 ? Math.min(...last7.map((c) => c.low)) : null;
  const hi30 = last30.length > 0 ? Math.max(...last30.map((c) => c.high)) : null;
  const lo30 = last30.length > 0 ? Math.min(...last30.map((c) => c.low)) : null;

  const avgVol30 =
    last30.length > 0 ? last30.reduce((a, c) => a + c.volume, 0) / last30.length : null;
  const volRatio = day && avgVol30 && avgVol30 > 0 ? day.volume / avgVol30 : null;
  const volumeFlag =
    volRatio === null ? null : volRatio >= 1.5 ? "elevated" : volRatio <= 0.5 ? "muted" : "normal";

  const hourLabel = (ts: number) =>
    `${String(new Date(ts).getUTCHours()).padStart(2, "0")}:00 UTC`;

  const lines: string[] = [];
  lines.push(`# ${inp.symbol} daily report — ${inp.date}`);
  lines.push("");
  if (day) {
    const dir =
      changePct === null ? "flat" : changePct > 0.05 ? "higher" : changePct < -0.05 ? "lower" : "flat";
    lines.push(
      `${inp.symbol} closed ${dir} at ${fmt(day.close)} USDT` +
        (changePct !== null ? ` (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}% on the day)` : "") +
        `. The session ranged between ${fmt(day.low)} and ${fmt(day.high)}.`
    );
  } else {
    lines.push(`No daily candle was available for ${inp.date} from the configured sources.`);
  }
  lines.push("");
  lines.push(`## Session numbers`);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Open | ${fmt(day?.open ?? null)} |`);
  lines.push(`| High | ${fmt(day?.high ?? null)} |`);
  lines.push(`| Low | ${fmt(day?.low ?? null)} |`);
  lines.push(`| Close | ${fmt(day?.close ?? null)} |`);
  lines.push(
    `| Change | ${changePct === null ? "n/a" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`} |`
  );
  // Candle volume is denominated in the BASE asset (PI), so it must not carry
  // a dollar sign — that would overstate the figure by the price of PI.
  lines.push(`| Volume | ${day ? `${fmtQty(day.volume)} PI` : "n/a"} |`);
  if (volumeFlag) {
    lines.push(`| Volume vs 30d avg | ${volRatio!.toFixed(2)}x (${volumeFlag}) |`);
  }
  lines.push("");

  if (bestHour && worstHour) {
    lines.push(`## Notable moves`);
    lines.push("");
    lines.push(
      `The strongest hour was ${hourLabel(bestHour.ts)} (${bestHour.pct >= 0 ? "+" : ""}${bestHour.pct.toFixed(2)}%); ` +
        `the weakest was ${hourLabel(worstHour.ts)} (${worstHour.pct >= 0 ? "+" : ""}${worstHour.pct.toFixed(2)}%).`
    );
    lines.push("");
  }

  lines.push(`## Levels in view`);
  lines.push("");
  lines.push(
    `Based on recent trading: prior-day high/low at ${fmt(prevDay?.high ?? null)} / ${fmt(prevDay?.low ?? null)}, ` +
      `7-day range ${fmt(lo7)}–${fmt(hi7)}, 30-day range ${fmt(lo30)}–${fmt(hi30)}. ` +
      `Historically, ranges like these have acted as reference zones rather than firm barriers — treat them as context, not targets.`
  );
  lines.push("");

  if (inp.fundingRate !== null) {
    const bp = inp.fundingRate * 100;
    const lean =
      inp.fundingRate > 0.0003 ? "long-leaning" : inp.fundingRate < -0.0003 ? "short-leaning" : "near neutral";
    lines.push(`## Derivatives context`);
    lines.push("");
    lines.push(
      `Perpetual funding on the reference venue printed ${bp.toFixed(4)}% at generation time — ${lean} positioning. ` +
        `Funding is a crowd-positioning gauge; it shifts quickly and is shown for context only.`
    );
    lines.push("");
  }

  lines.push(`---`);
  lines.push(
    `*Auto-generated from ${inp.source} market data. Not financial advice. Trading involves risk of loss. ` +
      `Figures are “as of” their stated timestamps and may differ between venues.*`
  );

  return {
    contentMd: lines.join("\n"),
    data: {
      changePct,
      bestHour,
      worstHour,
      hi7,
      lo7,
      hi30,
      lo30,
      volRatio,
      volumeFlag,
      fundingRate: inp.fundingRate,
      source: inp.source,
    },
  };
}

/** Fetch market inputs for a date. Prefers own snapshots later; v1 uses exchange daily/hourly candles. */
async function fetchInputs(symbol: string, date: string): Promise<ReportInputs> {
  const agg = getAggregator();
  const dayStartMs = Date.parse(`${date}T00:00:00.000Z`);
  const dayEndMs = dayStartMs + 24 * 3600 * 1000;

  const { candles: daily, source } = await agg.collectCandles(symbol, "1d", 60);
  const day = daily.find((c) => c.ts >= dayStartMs && c.ts < dayEndMs) ?? null;
  const before = daily.filter((c) => c.ts < dayStartMs);
  const prevDay = before.length > 0 ? before[before.length - 1]! : null;
  const upTo = daily.filter((c) => c.ts < dayEndMs);
  const last7 = upTo.slice(-7);
  const last30 = upTo.slice(-30);

  let hours: Candle[] = [];
  try {
    const { candles: hourly } = await agg.collectCandles(symbol, "1h", 200);
    hours = hourly.filter((c) => c.ts >= dayStartMs && c.ts < dayEndMs);
  } catch {
    hours = [];
  }

  const funding = await okx.fetchFunding(symbol);

  return { date, symbol, day, prevDay, last7, last30, hours, fundingRate: funding?.rate ?? null, source };
}

/**
 * Generate (or return the existing) report for a UTC date.
 * Returns { report, created } — created=false means the idempotency
 * constraint short-circuited a re-run.
 */
export async function generateDailyReport(
  symbol: string,
  date: string,
  db?: Db
): Promise<{ report: DailyReport; created: boolean }> {
  const d = db ?? (await getDb());

  const existing = await d.query(`SELECT * FROM daily_reports WHERE symbol = $1 AND report_date = $2`, [
    symbol,
    date,
  ]);
  if (existing.rows[0]) {
    return { report: mapReport(existing.rows[0]), created: false };
  }

  const inputs = await fetchInputs(symbol, date);

  // Refuse to persist a contentless report. Generation is idempotent, so an
  // empty row written because the candle window did not reach that date would
  // be permanent and un-regenerable — a blank day in the archive forever.
  // Failing instead lets the next scheduled run (or a manual --date) fill it.
  if (!inputs.day) {
    throw new Error(
      `no daily candle available for ${symbol} on ${date}; refusing to persist an empty report — retry once the venue serves that range`
    );
  }

  const { contentMd, data } = buildReportContent(inputs);
  const day = inputs.day;
  const changePct = day && day.open > 0 ? ((day.close - day.open) / day.open) * 100 : null;

  await d.query(
    `INSERT INTO daily_reports (symbol, report_date, open, high, low, close, change_pct, volume, content_md, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (symbol, report_date) DO NOTHING`,
    [
      symbol,
      date,
      day?.open ?? null,
      day?.high ?? null,
      day?.low ?? null,
      day?.close ?? null,
      changePct,
      day?.volume ?? null,
      contentMd,
      JSON.stringify(data),
    ]
  );

  const after = await d.query(`SELECT * FROM daily_reports WHERE symbol = $1 AND report_date = $2`, [
    symbol,
    date,
  ]);
  return { report: mapReport(after.rows[0]!), created: true };
}

export async function listReports(symbol: string, limit = 30, db?: Db): Promise<DailyReport[]> {
  const d = db ?? (await getDb());
  const { rows } = await d.query(
    `SELECT * FROM daily_reports WHERE symbol = $1 ORDER BY report_date DESC LIMIT $2`,
    [symbol, Math.min(limit, 90)]
  );
  return rows.map(mapReport);
}
