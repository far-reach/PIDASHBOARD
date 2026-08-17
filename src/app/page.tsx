"use client";

import Link from "next/link";
import { PriceHero } from "@/components/PriceHero";
import { PriceChart } from "@/components/PriceChart";
import { StatsGrid } from "@/components/StatsGrid";
import { ReportView } from "@/components/ReportView";
import { SignalCard } from "@/components/SignalCard";
import { SupportCard } from "@/components/SupportCard";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { useReports, useSignals } from "@/lib/hooks";
import { timeAgo } from "@/lib/format";
import { SIGNALS_ENABLED } from "@/lib/env";

export default function HomePage() {
  const { data: reports, fromCache: reportsFromCache } = useReports();
  const { data: signals } = useSignals();
  const latestReport = reports?.reports[0] ?? null;
  const recentSignals = SIGNALS_ENABLED ? (signals?.signals.slice(0, 3) ?? []) : [];

  return (
    <div className="space-y-3 pb-4">
      <PriceHero />
      <StatsGrid />
      <PriceChart />

      <Card>
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
                hint="Every signal that is ever published stays in the record — wins and losses alike."
              />
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>What this app does — and does not do</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            <p>
              Cybrekt Market reports what the PIUSDT market <em>did</em>: prices as published by
              public exchanges, with the source and timestamp shown, and an automatic daily
              summary of the session.
            </p>
            <p className="text-muted-foreground">
              It does not forecast prices, assert what any asset is worth, recommend buying
              or selling, or set levels to trade against. It is a record of observed market
              data, for informational and educational use only.{" "}
              <Link href="/learn" className="text-primary hover:underline">
                How to read this data →
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      <SupportCard />
    </div>
  );
}
