"use client";

/**
 * One compact strip for the session numbers that used to be five separate
 * cards: the 24h range as a visual bar with the live price marked on it, and
 * a row of small stats (bid/ask spread, volume, funding). Everything is an
 * observation with its venue and timestamp shown elsewhere on the hero badge;
 * this strip never repeats what the hero already says.
 */
import { Card, CardContent } from "@/components/ui";
import { fmtCompact, fmtPrice, fmtUtcTime } from "@/lib/format";
import { useFunding, useLatestPrice } from "@/lib/hooks";

export function SessionStrip() {
  const { data } = useLatestPrice();
  const { data: funding } = useFunding();
  if (!data) return null;

  const spread =
    data.bid !== null && data.ask !== null && data.ask > 0
      ? (((data.ask - data.bid) / data.ask) * 100).toFixed(3)
      : null;

  const lo = data.low_24h;
  const hi = data.high_24h;
  const posPct =
    lo !== null && hi !== null && hi > lo
      ? Math.min(100, Math.max(0, ((data.price - lo) / (hi - lo)) * 100))
      : null;

  const hasFunding = funding?.rate !== null && funding?.rate !== undefined;
  const fundingPct = hasFunding ? funding.rate! * 100 : null;

  return (
    <Card data-testid="session-strip">
      <CardContent className="pt-4 space-y-3">
        {posPct !== null ? (
          <div>
            <div className="flex items-baseline justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Rolling 24h range</span>
              <span className="font-tabular normal-case tracking-normal">
                {fmtPrice(lo)} – {fmtPrice(hi)}
              </span>
            </div>
            <div className="relative mt-1.5 h-1.5 rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary/30"
                style={{ width: `${posPct}%` }}
              />
              <div
                aria-hidden
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-background bg-primary"
                style={{ left: `${posPct}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Bid · Ask
            </div>
            <div className="font-tabular truncate">
              {fmtPrice(data.bid)} · {fmtPrice(data.ask)}
            </div>
            <div className="text-[11px] text-muted-foreground font-tabular">
              {spread ? `spread ${spread}%` : `as of ${fmtUtcTime(data.ts)}`}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Venue volume
            </div>
            <div className="font-tabular truncate">${fmtCompact(data.volume_24h)}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {data.source} · 24h USDT
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Funding (perp)
            </div>
            {hasFunding ? (
              <>
                <div
                  className={`font-tabular truncate ${
                    fundingPct! > 0 ? "text-up" : fundingPct! < 0 ? "text-down" : ""
                  }`}
                >
                  {fundingPct! >= 0 ? "+" : ""}
                  {fundingPct!.toFixed(4)}%
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {fundingPct! > 0
                    ? "longs pay shorts"
                    : fundingPct! < 0
                      ? "shorts pay longs"
                      : "neutral"}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">n/a</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
