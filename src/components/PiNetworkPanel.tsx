"use client";

/**
 * Network-level view of PI: supply and market figures, the share of maximum
 * supply now circulating, and the app's own supply history once enough daily
 * snapshots exist.
 *
 * Everything shown is a reported, attributed, timestamped fact, or plain
 * arithmetic on those facts. Source attribution (CoinGecko's free API asks
 * for it) lives in the site-wide footer, which is public on every screen;
 * see COMPLIANCE.md §3b.
 */
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { usePiStats } from "@/lib/hooks";
import { timeAgo } from "@/lib/format";

function compactNumber(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
}

/** One figure in a group: label above, value below, optional note. */
function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
        {label}
      </div>
      <div className="font-tabular text-base font-semibold truncate">{value}</div>
      {note ? <div className="text-[11px] text-muted-foreground truncate">{note}</div> : null}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
      {children}
    </div>
  );
}

export function PiNetworkPanel() {
  const { data, fromCache, isLoading } = usePiStats();

  if (isLoading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pi network</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const stats = data?.stats ?? null;
  const pct = stats?.circulatingPctOfMax ?? null;

  // Two comparisons the raw figures do not state on their own, both plain
  // arithmetic on numbers already shown: how much of the network's value
  // changed hands today, and how much larger the fully-diluted figure is
  // than the current one. Descriptive, never projections.
  const turnoverPct =
    stats?.volume24hUsd && stats.marketCapUsd && stats.marketCapUsd > 0
      ? (stats.volume24hUsd / stats.marketCapUsd) * 100
      : null;
  const dilutionX =
    stats?.fdvUsd && stats.marketCapUsd && stats.marketCapUsd > 0
      ? stats.fdvUsd / stats.marketCapUsd
      : null;

  return (
    <Card data-testid="pi-network-panel">
      <CardHeader>
        <CardTitle>Pi network</CardTitle>
        <span className="inline-flex items-center gap-1.5">
          {fromCache ? <Badge tone="warn">offline · last known</Badge> : null}
          {stats ? <Badge tone="neutral">updated {timeAgo(stats.asOf)}</Badge> : null}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats ? (
          <>
            <section className="space-y-2">
              <GroupLabel>Supply</GroupLabel>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <Figure
                  label="Circulating"
                  value={`${compactNumber(stats.circulatingSupply)} π`}
                  note={stats.maxSupply ? `of ${compactNumber(stats.maxSupply)} maximum` : undefined}
                />
                <Figure
                  label="Issued so far"
                  value={`${compactNumber(stats.totalSupply)} π`}
                  note="total supply, mined or locked"
                />
              </div>
              {pct !== null ? (
                <div className="pt-0.5">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Share of the maximum PI supply now circulating"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-[11px] text-muted-foreground">
                    <span className="font-tabular">{pct.toFixed(1)}% released</span>
                    <span className="font-tabular">{(100 - pct).toFixed(1)}% not yet circulating</span>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="space-y-2 border-t border-border/60 pt-3">
              <GroupLabel>Market</GroupLabel>
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <Figure
                  label="Market cap"
                  value={`$${compactNumber(stats.marketCapUsd)}`}
                  note="circulating supply"
                />
                <Figure
                  label="Fully diluted"
                  value={`$${compactNumber(stats.fdvUsd)}`}
                  note={
                    stats.totalSupply
                      ? `at ${compactNumber(stats.totalSupply)} issued${dilutionX ? `, ${dilutionX.toFixed(2)}× the cap` : ""}`
                      : dilutionX
                        ? `${dilutionX.toFixed(2)}× the market cap`
                        : undefined
                  }
                />
                <Figure
                  label="Global 24h volume"
                  value={`$${compactNumber(stats.volume24hUsd)}`}
                  note="every venue and pair"
                />
                <Figure
                  label="Daily turnover"
                  value={turnoverPct !== null ? `${turnoverPct.toFixed(2)}%` : "n/a"}
                  note="of market cap traded in 24h"
                />
              </div>
            </section>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Network figures are unavailable right now. They return automatically once the data
            source responds.
          </p>
        )}

        <SupplyHistory history={data?.history ?? []} />
      </CardContent>
    </Card>
  );
}

/**
 * The app's own daily supply observations, drawn as a simple inline SVG area.
 * Appears only once a week of snapshots exists; before that it renders
 * nothing rather than explaining its own bookkeeping to the reader.
 */
function SupplyHistory({
  history,
}: {
  history: { date: string; circulatingSupply: number | null }[];
}) {
  const points = history.filter(
    (h): h is { date: string; circulatingSupply: number } => h.circulatingSupply !== null
  );

  if (points.length < 7) return null;

  const w = 320;
  const h = 64;
  const values = points.map((p) => p.circulatingSupply);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const xy = points.map((p, i) => [i * step, h - 6 - ((p.circulatingSupply - min) / span) * (h - 12)]);
  const line = xy
    .map(([x = 0, y = 0], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const growthPct =
    first.circulatingSupply > 0
      ? ((last.circulatingSupply - first.circulatingSupply) / first.circulatingSupply) * 100
      : null;

  return (
    <section className="border-t border-border/60 pt-3" data-testid="supply-history">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <GroupLabel>Circulating supply, observed daily</GroupLabel>
        {growthPct !== null ? (
          <span className="font-tabular text-[11px] text-muted-foreground">
            {growthPct >= 0 ? "+" : ""}
            {growthPct.toFixed(2)}% over {points.length} days
          </span>
        ) : null}
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-16 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Circulating supply from ${compactNumber(first.circulatingSupply)} on ${first.date} to ${compactNumber(last.circulatingSupply)} on ${last.date}`}
      >
        <path d={area} fill="hsl(var(--primary) / 0.12)" />
        <path
          d={line}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between font-tabular text-[10px] text-muted-foreground">
        <span>{first.date}</span>
        <span>{last.date}</span>
      </div>
    </section>
  );
}
