"use client";

import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { PriceHero } from "@/components/PriceHero";
import { PriceChart } from "@/components/PriceChart";
import { SessionStrip } from "@/components/SessionStrip";
import { ContextPanel } from "@/components/ContextPanel";
import { VenuesPanel } from "@/components/VenuesPanel";
import { PiNetworkPanel } from "@/components/PiNetworkPanel";
import { ReportView } from "@/components/ReportView";
import { SignalCard } from "@/components/SignalCard";
import { CustomizePanel } from "@/components/CustomizePanel";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { useReports, useSignals } from "@/lib/hooks";
import { timeAgo } from "@/lib/format";
import { SIGNALS_ENABLED } from "@/lib/env";
import { useLayoutPrefs, type SectionId } from "@/lib/layout-prefs";

export default function HomePage() {
  const { data: reports, fromCache: reportsFromCache } = useReports();
  const { data: signals } = useSignals();
  const prefs = useLayoutPrefs();
  const [editing, setEditing] = useState(false);

  const latestReport = reports?.reports[0] ?? null;
  const recentSignals = SIGNALS_ENABLED ? (signals?.signals.slice(0, 3) ?? []) : [];

  const sections: Record<SectionId, React.ReactNode> = {
    stats: <SessionStrip key="stats" />,
    context: <ContextPanel key="context" />,
    venues: <VenuesPanel key="venues" />,
    network: <PiNetworkPanel key="network" />,
    chart: <PriceChart key="chart" />,
    report: (
      <Card key="report">
        <CardHeader>
          <CardTitle>Daily report</CardTitle>
          <span className="inline-flex items-center gap-1.5">
            {reportsFromCache ? <Badge tone="warn">offline · last known</Badge> : null}
            {latestReport ? (
              <Badge tone="neutral">generated {timeAgo(latestReport.generated_at)}</Badge>
            ) : null}
            <Link href="/reports" className="text-xs text-primary hover:underline">
              archive →
            </Link>
          </span>
        </CardHeader>
        <CardContent>
          {latestReport ? (
            <ReportView markdown={latestReport.content_md} />
          ) : (
            <EmptyState
              title="No daily report yet."
              hint="Reports generate automatically at 00:05 UTC once the report worker is running."
            />
          )}
        </CardContent>
      </Card>
    ),
  };

  return (
    <div className="space-y-3 pb-4">
      <PriceHero />

      {SIGNALS_ENABLED ? (
        <Card>
          <CardHeader>
            <CardTitle>Latest signals</CardTitle>
            <Link href="/signals" className="text-xs text-primary hover:underline">
              full feed →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSignals.length > 0 ? (
              recentSignals.map((s) => <SignalCard key={s.id} signal={s} />)
            ) : (
              <EmptyState
                title="No signals published yet."
                hint="Every signal that is ever published stays in the record, wins and losses alike."
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      {editing ? (
        <CustomizePanel onClose={() => setEditing(false)} />
      ) : (
        prefs.order.filter((id) => !prefs.hidden.includes(id)).map((id) => sections[id])
      )}

      {!editing ? (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 px-3"
            data-testid="customize-open"
          >
            <SlidersHorizontal size={13} />
            Arrange dashboard
          </button>
        </div>
      ) : null}
    </div>
  );
}
