"use client";

import { EquityChart } from "@/components/EquityChart";
import { RHistogram } from "@/components/RHistogram";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton, Stat } from "@/components/ui";
import { usePerformance } from "@/lib/hooks";
import { fmtR, fmtUtcTime } from "@/lib/format";

export default function PerformancePage() {
  const { data, fromCache, isLoading } = usePerformance();
  const perf = data?.performance;

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold">Performance</h1>
        <div className="flex items-center gap-1.5">
          {fromCache ? <Badge tone="warn">offline · last known</Badge> : null}
          {perf ? <Badge tone="neutral">computed {fmtUtcTime(perf.computedAt)}</Badge> : null}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Every number below is recomputed from the immutable signal event log on each request —
        there is no manual override. Full history, including drawdowns. Past performance does not
        indicate future results.
      </p>

      {isLoading && !perf ? (
        <Skeleton className="h-64 w-full" />
      ) : perf ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="perf-stats">
            <Stat
              label="Win rate"
              value={perf.winRatePct !== null ? `${perf.winRatePct.toFixed(1)}%` : "—"}
              sub={`${perf.wins}W / ${perf.losses}L of ${perf.scored}`}
            />
            <Stat
              label="Avg R"
              value={fmtR(perf.avgR)}
              tone={perf.avgR !== null ? (perf.avgR > 0 ? "up" : "down") : undefined}
              sub={`total ${fmtR(perf.sumR)}`}
            />
            <Stat
              label="Max drawdown"
              value={`-${perf.maxDrawdownR.toFixed(2)}R`}
              tone={perf.maxDrawdownR > 0 ? "down" : undefined}
              sub={`worst ${fmtR(perf.worstR)} · best ${fmtR(perf.bestR)}`}
            />
            <Stat
              label="Streak"
              value={
                perf.currentStreak === 0
                  ? "—"
                  : `${Math.abs(perf.currentStreak)} ${perf.currentStreak > 0 ? "win" : "loss"}${Math.abs(perf.currentStreak) > 1 ? "s" : ""}`
              }
              tone={perf.currentStreak > 0 ? "up" : perf.currentStreak < 0 ? "down" : undefined}
              sub={`${perf.openSignals} open now`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cumulative R — full history</CardTitle>
            </CardHeader>
            <CardContent>
              <EquityChart curve={perf.equityCurve} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {perf.monthly.length > 0 ? (
                <div className="overflow-x-auto thin-scroll">
                  <table className="w-full text-sm" data-testid="monthly-table">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-1.5 pr-3 font-medium">Month</th>
                        <th className="py-1.5 pr-3 font-medium">Signals</th>
                        <th className="py-1.5 pr-3 font-medium">W / L</th>
                        <th className="py-1.5 font-medium">Net R</th>
                      </tr>
                    </thead>
                    <tbody className="font-tabular">
                      {[...perf.monthly].reverse().map((m) => (
                        <tr key={m.month} className="border-t border-border">
                          <td className="py-1.5 pr-3">{m.month}</td>
                          <td className="py-1.5 pr-3">{m.n}</td>
                          <td className="py-1.5 pr-3">
                            {m.wins} / {m.losses}
                          </td>
                          <td className={`py-1.5 ${m.sumR > 0 ? "text-up" : m.sumR < 0 ? "text-down" : ""}`}>
                            {fmtR(m.sumR)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No closed signals yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>R-multiple distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <RHistogram histogram={perf.histogram} />
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Performance data unavailable.</p>
      )}
    </div>
  );
}
