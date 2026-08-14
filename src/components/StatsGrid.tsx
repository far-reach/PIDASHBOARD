"use client";

import { Stat } from "@/components/ui";
import { fmtCompact, fmtPrice } from "@/lib/format";
import { useLatestPrice } from "@/lib/hooks";

export function StatsGrid() {
  const { data } = useLatestPrice();
  if (!data) return null;

  const spread =
    data.bid !== null && data.ask !== null && data.ask > 0
      ? (((data.ask - data.bid) / data.ask) * 100).toFixed(3)
      : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="stats-grid">
      <Stat label="Bid" value={fmtPrice(data.bid)} />
      <Stat label="Ask" value={fmtPrice(data.ask)} sub={spread ? `spread ${spread}%` : undefined} />
      <Stat label="24h high" value={fmtPrice(data.high_24h)} />
      <Stat label="24h low" value={fmtPrice(data.low_24h)} sub={`vol $${fmtCompact(data.volume_24h)}`} />
    </div>
  );
}
