"use client";

import { useState } from "react";
import { ReportView } from "@/components/ReportView";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from "@/components/ui";
import { useReports } from "@/lib/hooks";
import { fmtPct } from "@/lib/format";
import { clsx } from "clsx";

export default function ReportsPage() {
  const { data, fromCache, isLoading } = useReports();
  const reports = data?.reports ?? [];
  const [selected, setSelected] = useState(0);
  const current = reports[selected] ?? null;

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold">Daily reports</h1>
        {fromCache ? <Badge tone="warn">offline · last known</Badge> : null}
      </div>

      {isLoading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports generated yet."
          hint="One report is generated automatically per UTC day. Re-runs never alter an existing report."
        />
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto thin-scroll pb-1" data-testid="report-archive">
            {reports.map((r, i) => (
              <button
                key={r.date}
                onClick={() => setSelected(i)}
                className={clsx(
                  "shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-tabular",
                  i === selected
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <div>{r.date}</div>
                <div
                  className={clsx(
                    "font-medium",
                    r.change_pct !== null && r.change_pct >= 0 ? "text-up" : "text-down"
                  )}
                >
                  {fmtPct(r.change_pct)}
                </div>
              </button>
            ))}
          </div>

          {current ? (
            <Card>
              <CardHeader>
                <CardTitle>{current.date}</CardTitle>
                <Badge tone="neutral">30-day archive</Badge>
              </CardHeader>
              <CardContent>
                <ReportView markdown={current.content_md} />
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
