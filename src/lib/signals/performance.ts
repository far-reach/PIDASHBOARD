/**
 * Performance metrics, derived exclusively from resolved signal outcomes.
 * No stored aggregates, no admin override (brief §3.2, §3.5). Losing months
 * appear exactly as they happened.
 */
import type { SignalWithOutcome } from "@/lib/signals/types";

export interface EquityPoint {
  ts: string;
  cumR: number;
}

export interface MonthlyRow {
  month: string; // "2026-08"
  n: number;
  wins: number;
  losses: number;
  sumR: number;
}

export interface HistogramBin {
  from: number;
  to: number;
  label: string;
  count: number;
}

export interface PerformanceSummary {
  totalSignals: number;
  openSignals: number;
  closedSignals: number;
  /** Closed signals with a known exit price — the basis for all R stats. */
  scored: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  avgR: number | null;
  sumR: number;
  bestR: number | null;
  worstR: number | null;
  maxDrawdownR: number;
  /** +n = n consecutive wins, -n = n consecutive losses, 0 = no closed signals. */
  currentStreak: number;
  equityCurve: EquityPoint[];
  monthly: MonthlyRow[];
  histogram: HistogramBin[];
  computedAt: string;
}

const isWin = (r: number) => r > 0;

export function computePerformance(
  signals: SignalWithOutcome[],
  now: Date = new Date()
): PerformanceSummary {
  const open = signals.filter((s) => s.status === "open");
  const closed = signals.filter((s) => s.status !== "open");
  const scored = closed
    .filter((s) => s.r !== null && s.closedAt !== null)
    .sort((a, b) => a.closedAt!.localeCompare(b.closedAt!));

  const rs = scored.map((s) => s.r!);
  const wins = rs.filter(isWin).length;
  const losses = rs.length - wins;

  // Equity curve + max drawdown in R units.
  let cum = 0;
  let peak = 0;
  let maxDd = 0;
  const equityCurve: EquityPoint[] = scored.map((s) => {
    cum += s.r!;
    peak = Math.max(peak, cum);
    maxDd = Math.max(maxDd, peak - cum);
    return { ts: s.closedAt!, cumR: round4(cum) };
  });

  // Current streak from the most recent closed signal backwards.
  let streak = 0;
  for (let i = rs.length - 1; i >= 0; i--) {
    const w = isWin(rs[i]!);
    if (streak === 0) {
      streak = w ? 1 : -1;
    } else if (w && streak > 0) {
      streak++;
    } else if (!w && streak < 0) {
      streak--;
    } else {
      break;
    }
  }

  // Monthly breakdown (UTC month of close).
  const byMonth = new Map<string, MonthlyRow>();
  for (const s of scored) {
    const month = s.closedAt!.slice(0, 7);
    const row = byMonth.get(month) ?? { month, n: 0, wins: 0, losses: 0, sumR: 0 };
    row.n++;
    if (isWin(s.r!)) row.wins++;
    else row.losses++;
    row.sumR = round4(row.sumR + s.r!);
    byMonth.set(month, row);
  }

  return {
    totalSignals: signals.length,
    openSignals: open.length,
    closedSignals: closed.length,
    scored: scored.length,
    wins,
    losses,
    winRatePct: rs.length > 0 ? round2((wins / rs.length) * 100) : null,
    avgR: rs.length > 0 ? round4(rs.reduce((a, b) => a + b, 0) / rs.length) : null,
    sumR: round4(rs.reduce((a, b) => a + b, 0)),
    bestR: rs.length > 0 ? round4(Math.max(...rs)) : null,
    worstR: rs.length > 0 ? round4(Math.min(...rs)) : null,
    maxDrawdownR: round4(maxDd),
    currentStreak: streak,
    equityCurve,
    monthly: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
    histogram: buildHistogram(rs),
    computedAt: now.toISOString(),
  };
}

/**
 * Fixed, symmetric bins so losses get the same resolution as wins.
 * Edge bins use finite sentinels (±999): Infinity does not survive JSON
 * serialization, and a null edge would misclassify the bin's win/loss side
 * in the client's `to <= 0` check.
 */
export function buildHistogram(rs: number[]): HistogramBin[] {
  const edges = [-3, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3];
  const BOUND = 999;
  const bins: HistogramBin[] = [];
  bins.push({ from: -BOUND, to: edges[0]!, label: `< ${edges[0]}R`, count: 0 });
  for (let i = 0; i < edges.length - 1; i++) {
    bins.push({
      from: edges[i]!,
      to: edges[i + 1]!,
      label: `${edges[i]}R to ${edges[i + 1]}R`,
      count: 0,
    });
  }
  bins.push({ from: edges[edges.length - 1]!, to: BOUND, label: `≥ ${edges[edges.length - 1]}R`, count: 0 });
  for (const r of rs) {
    // Fall back by SIGN, never blindly to the last bin: an extreme loss
    // (below the lowest edge) landing in the top "≥ 3R" bin would paint a
    // catastrophic outcome as the best possible one.
    const bin =
      bins.find((b) => r >= b.from && r < b.to) ?? (r < 0 ? bins[0]! : bins[bins.length - 1]!);
    bin.count++;
  }
  return bins;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
