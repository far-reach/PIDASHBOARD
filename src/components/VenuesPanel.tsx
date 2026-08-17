"use client";

/**
 * "Across venues": the same market seen from each exchange at once: last
 * price and spread per venue, the widest gap between fresh quotes, and the
 * recent settled funding history from the OKX perp as a small bar series.
 * Venues that failed to answer are absent, never faked.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { fmtPrice, fmtUtcTime } from "@/lib/format";
import { useMicrostructure } from "@/lib/hooks";

const VENUE_LABEL: Record<string, string> = { okx: "OKX", mexc: "MEXC", bitget: "Bitget" };

export function VenuesPanel() {
  const { data } = useMicrostructure();
  if (!data || data.venues.length === 0) return null;

  const funding = data.funding_history;
  const maxAbs = funding.length ? Math.max(...funding.map((f) => Math.abs(f.rate)), 1e-9) : 0;

  return (
    <Card data-testid="venues-panel">
      <CardHeader>
        <CardTitle>Across venues</CardTitle>
        <span className="text-[11px] text-muted-foreground">as of {fmtUtcTime(data.as_of)}</span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-1 text-left font-medium">Venue</th>
                <th className="pb-1 text-right font-medium">Last price</th>
                <th className="pb-1 text-right font-medium">Spread</th>
              </tr>
            </thead>
            <tbody className="font-tabular">
              {data.venues.map((v) => (
                <tr key={v.source} className="border-t border-border/60">
                  <td className="py-1.5 font-sans">{VENUE_LABEL[v.source] ?? v.source}</td>
                  <td className="py-1.5 text-right">{fmtPrice(v.price)}</td>
                  <td className="py-1.5 text-right text-muted-foreground">
                    {v.spread_pct !== null ? `${v.spread_pct.toFixed(3)}%` : "n/a"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.divergence_pct !== null && data.venues.length >= 2 ? (
          <p className="text-xs text-muted-foreground">
            Widest gap between venues right now:{" "}
            <span className="font-tabular text-foreground">{data.divergence_pct.toFixed(3)}%</span>
            . Venues differ because each has its own order book; there is no single universal
            price.
          </p>
        ) : null}

        {funding.length >= 4 ? (
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Settled funding, last {funding.length} periods
              </span>
              <span className="text-[11px] text-muted-foreground">OKX perp · 8h each</span>
            </div>
            <div className="mt-1.5 flex h-10 items-center gap-[3px]" aria-hidden>
              {funding.map((f) => {
                const h = Math.max(8, (Math.abs(f.rate) / maxAbs) * 100);
                return (
                  <div key={f.ts} className="flex h-full flex-1 flex-col justify-center">
                    <div
                      className={`w-full rounded-sm ${f.rate >= 0 ? "bg-up/70" : "bg-down/70"}`}
                      style={{ height: `${h / 2}%` }}
                      title={`${(f.rate * 100).toFixed(4)}% · ${new Date(f.ts).toISOString().slice(0, 13)}:00 UTC`}
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Positive periods (longs paid shorts) in green, negative in red; bar height is
              the rate&apos;s size. An indication of how crowded each side was, not a
              forecast.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
