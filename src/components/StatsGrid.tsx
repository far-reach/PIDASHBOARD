"use client";

import { Stat } from "@/components/ui";
import { fmtCompact, fmtPrice, fmtUtcTime } from "@/lib/format";
import { useFunding, useLatestPrice } from "@/lib/hooks";

export function StatsGrid() {
  const { data } = useLatestPrice();
  const { data: funding } = useFunding();
  if (!data) return null;

  const spread =
    data.bid !== null && data.ask !== null && data.ask > 0
      ? (((data.ask - data.bid) / data.ask) * 100).toFixed(3)
      : null;

  // Funding is only meaningful when a perpetual market exists for the symbol.
  const hasFunding = funding?.rate !== null && funding?.rate !== undefined;
  const fundingPct = hasFunding ? funding.rate! * 100 : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="stats-grid">
      <Stat label="Bid" value={fmtPrice(data.bid)} sub={`as of ${fmtUtcTime(data.ts)}`} />
      <Stat label="Ask" value={fmtPrice(data.ask)} sub={spread ? `spread ${spread}%` : undefined} />
      <Stat label="24h high" value={fmtPrice(data.high_24h)} />
      <Stat label="24h low" value={fmtPrice(data.low_24h)} sub={`vol $${fmtCompact(data.volume_24h)}`} />
      {hasFunding ? (
        <Stat
          label="Funding (perp)"
          value={`${fundingPct! >= 0 ? "+" : ""}${fundingPct!.toFixed(4)}%`}
          tone={fundingPct! > 0 ? "up" : fundingPct! < 0 ? "down" : undefined}
          sub={`${fundingPct! > 0 ? "longs pay shorts" : fundingPct! < 0 ? "shorts pay longs" : "neutral"} · as of ${fmtUtcTime(funding!.as_of)}`}
        />
      ) : null}
    </div>
  );
}
