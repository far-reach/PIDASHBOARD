"use client";

/**
 * Network-level view of PI: the 24h behavior line, supply and market figures,
 * and the app's own supply history once enough daily snapshots exist.
 *
 * Everything shown is a reported, attributed, timestamped fact. The panel
 * carries the attribution its data sources require, as plain text (no
 * outbound links; the Pi ecosystem rules ask apps not to send users off-site).
 */
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton, Stat } from "@/components/ui";
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

  return (
    <Card data-testid="pi-network-panel">
      <CardHeader>
        <CardTitle>Pi network</CardTitle>
        <span className="inline-flex items-center gap-1.5">
          {fromCache ? <Badge tone="warn">offline · last known</Badge> : null}
          {stats ? <Badge tone="neutral">updated {timeAgo(stats.asOf)}</Badge> : null}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat
                label="Circulating"
                value={`${compactNumber(stats.circulatingSupply)} π`}
                sub={stats.maxSupply ? `of ${compactNumber(stats.maxSupply)} max` : undefined}
              />
              <Stat label="Market cap" value={`$${compactNumber(stats.marketCapUsd)}`} />
              <Stat
                label="Global 24h volume"
                value={`$${compactNumber(stats.volume24hUsd)}`}
                sub="all venues"
              />
              <Stat
                label="Fully diluted"
                value={`$${compactNumber(stats.fdvUsd)}`}
                sub="at max supply"
              />
            </div>

            {pct !== null ? (
              <div>
                <div className="flex items-baseline justify-between text-[11px] text-muted-foreground mb-1">
                  <span className="uppercase tracking-wider">Supply released</span>
                  <span className="font-tabular">{pct.toFixed(1)}% of max</span>
                </div>
                <div
                  className="h-2 rounded-full bg-muted overflow-hidden"
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
                <p className="text-[11px] text-muted-foreground mt-1">
                  The rest is not yet circulating. As more unlocks over time, this bar and the
                  chart below record it happening.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Network figures are unavailable right now. They return automatically once the data
            source responds.
          </p>
        )}

        <SupplyHistory history={data?.history ?? []} />

        <p className="text-[10px] text-muted-foreground">
          {data?.attribution ?? "Market data: CoinGecko, OKX, MEXC"}. Figures as reported by
          their sources; not statements of value.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * The app's own daily supply observations, drawn as a simple inline SVG area.
 * Appears once a week of snapshots exists; before that a quiet note explains
 * the chart is building itself, which is true.
 */
function SupplyHistory({
  history,
}: {
  history: { date: string; circulatingSupply: number | null }[];
}) {
  const points = history.filter(
    (h): h is { date: string; circulatingSupply: number } => h.circulatingSupply !== null
  );

  if (points.length < 7) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Supply history: recording one observation per day ({points.length} so far). The growth
        chart appears after the first week.
      </p>
    );
  }

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

  return (
    <div data-testid="supply-history">
      <div className="flex items-baseline justify-between text-[11px] text-muted-foreground mb-1">
        <span className="uppercase tracking-wider">Circulating supply, observed daily</span>
        <span className="font-tabular">
          {first.date} to {last.date}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-16"
        role="img"
        aria-label={`Circulating supply from ${compactNumber(first.circulatingSupply)} on ${first.date} to ${compactNumber(last.circulatingSupply)} on ${last.date}`}
      >
        <path d={area} fill="hsl(var(--primary) / 0.12)" />
        <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground font-tabular">
        <span>{compactNumber(first.circulatingSupply)} π</span>
        <span>{compactNumber(last.circulatingSupply)} π</span>
      </div>
    </div>
  );
}
