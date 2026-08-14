"use client";

import { useState } from "react";
import { SignalCard } from "@/components/SignalCard";
import { Badge, Card, CardContent, EmptyState, SegmentedControl, Skeleton } from "@/components/ui";
import { useSignals } from "@/lib/hooks";
import { fmtUtcTime } from "@/lib/format";

type Filter = "all" | "open" | "closed";

export default function SignalsPage() {
  const { data, fromCache, isLoading } = useSignals();
  const [filter, setFilter] = useState<Filter>("all");

  const signals = data?.signals ?? [];
  const filtered = signals.filter((s) =>
    filter === "all" ? true : filter === "open" ? s.status === "open" : s.status !== "open"
  );
  const hiddenOpen = data?.meta.hidden_open_count ?? 0;

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold">Signals</h1>
        <div className="flex items-center gap-2">
          {fromCache ? <Badge tone="warn">offline · last known</Badge> : null}
          {data ? <Badge tone="neutral">as of {fmtUtcTime(data.meta.as_of)}</Badge> : null}
          <SegmentedControl
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Every published signal is permanent: entries, stops, targets, and outcomes cannot be edited
        after publication. Losing signals stay in this feed with the same prominence as winners.
        New here? <a className="text-primary hover:underline" href="/learn">Learn how to read them</a>.
      </p>

      {hiddenOpen > 0 && filter !== "closed" ? (
        <Card data-testid="gated-open-notice">
          <CardContent className="pt-4">
            <p className="text-sm">
              {hiddenOpen} open signal{hiddenOpen > 1 ? "s are" : " is"} currently live —
              visible to Pro subscribers. Closed history and performance are free for everyone,
              always.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {isLoading && !data ? (
        <div className="space-y-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2" data-testid="signals-feed">
          {filtered.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={filter === "open" ? "No open signals right now." : "No signals in the record yet."}
          hint="Signals appear here the moment they are published and never leave."
        />
      )}
    </div>
  );
}
