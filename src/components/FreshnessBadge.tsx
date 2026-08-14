"use client";

import { Badge } from "@/components/ui";
import { fmtUtcTime } from "@/lib/format";

/**
 * Every price-bearing surface carries one of these (brief §3.7): the source,
 * "as of HH:MM:SS UTC", staleness when > 60s, failover + divergence flags,
 * and an offline marker when showing cached data.
 */
export function FreshnessBadge({
  source,
  ts,
  isStale,
  isFailover,
  divergencePct,
  fromCache,
}: {
  source: string | null;
  ts: string | null;
  isStale?: boolean;
  isFailover?: boolean;
  divergencePct?: number | null;
  fromCache?: boolean;
}) {
  if (fromCache) {
    return (
      <Badge tone="warn" title="No network — showing the last data this device saw">
        ● offline · last known {ts ? `(${fmtUtcTime(ts)})` : ""}
      </Badge>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={isStale ? "warn" : "neutral"}>
        {source ?? "—"} · as of {fmtUtcTime(ts)}
        {isStale ? " · STALE" : ""}
      </Badge>
      {isFailover ? (
        <Badge tone="warn" title="Primary exchange feed is down; serving from the secondary source">
          failover
        </Badge>
      ) : null}
      {divergencePct !== null && divergencePct !== undefined && divergencePct > 1 ? (
        <Badge tone="warn" title="Prices on the two source exchanges differ by more than 1%">
          venues diverge {divergencePct.toFixed(1)}%
        </Badge>
      ) : null}
    </span>
  );
}
