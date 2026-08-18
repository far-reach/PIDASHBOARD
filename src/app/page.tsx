"use client";

import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { PriceHero } from "@/components/PriceHero";
import { SessionStrip } from "@/components/SessionStrip";
import { ContextPanel } from "@/components/ContextPanel";
import { VenuesPanel } from "@/components/VenuesPanel";
import { PiNetworkPanel } from "@/components/PiNetworkPanel";
import { ReportView } from "@/components/ReportView";
import { SignalCard } from "@/components/SignalCard";
import { CustomizePanel } from "@/components/CustomizePanel";
import { CollapsibleCard } from "@/components/CollapsibleCard";
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
    report: (
      <CollapsibleCard
        key="report"
        storageKey="report"
        defaultOpen={false}
        title={<CardTitle>Daily report</CardTitle>}
        headerRight={
          <>
            {reportsFromCache ? <Badge tone="warn">offline · last known</Badge> : null}
            {latestReport ? (
              <Badge tone="neutral">generated {timeAgo(latestReport.generated_at)}</Badge>
            ) : null}
            <Link href="/reports" className="text-xs text-primary hover:underline">
              archive →
            </Link>
          </>
        }
      >
        {latestReport ? (
          <ReportView markdown={latestReport.content_md} />
        ) : (
          <EmptyState
            title="No daily report yet."
            hint="Reports generate automatically at 00:05 UTC once the report worker is running."
          />
        )}
      </CollapsibleCard>
    ),
  };

  return (
    <div className="space-y-3 pb-4">
      {/* Arranging is a nice-to-have most visitors never touch, so it costs
          no layout: a small tab tucked against the right edge, inside the
          thumb's natural arc and above the bottom tab bar. It stays out of
          the way while scrolling and disappears while the panel is open. */}
      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Arrange dashboard sections"
          title="Arrange dashboard"
          className="fixed right-0 bottom-24 z-30 inline-flex h-11 w-9 items-center justify-center rounded-l-xl border border-r-0 border-border bg-card/85 text-muted-foreground shadow-lg backdrop-blur transition-colors hover:bg-card hover:text-foreground active:bg-card md:bottom-10"
          data-testid="customize-open"
        >
          <SlidersHorizontal size={16} />
        </button>
      ) : null}

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

    </div>
  );
}
