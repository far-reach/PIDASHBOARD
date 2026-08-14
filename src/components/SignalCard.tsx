"use client";

/**
 * One trading call. Winning and losing signals share EXACTLY the same
 * layout, size, and type scale (brief §3.5, §8): only the status badge tone
 * and the R value's color differ, and both always carry a text label.
 */
import { Badge, Card, CardContent } from "@/components/ui";
import { fmtPrice, fmtR, fmtUtcDateTime } from "@/lib/format";
import type { SignalDTO } from "@/lib/api-types";
import { clsx } from "clsx";

const STATUS_META: Record<
  SignalDTO["status"],
  { label: string; tone: "up" | "down" | "neutral" | "primary" | "warn" }
> = {
  open: { label: "OPEN", tone: "primary" },
  hit_tp: { label: "TARGET HIT", tone: "up" },
  hit_sl: { label: "STOPPED OUT", tone: "down" },
  expired: { label: "EXPIRED", tone: "neutral" },
  manual_close: { label: "CLOSED EARLY", tone: "neutral" },
};

export function SignalCard({ signal }: { signal: SignalDTO }) {
  const meta = STATUS_META[signal.status];
  const r = signal.status === "open" ? signal.unrealized_r : signal.r;
  const rLabel = signal.status === "open" ? "unrealized" : "realized";
  const closeEvent = signal.events.find((e) =>
    ["hit_tp", "hit_sl", "expired", "manual_close"].includes(e.type)
  );

  return (
    <Card data-testid="signal-card" data-status={signal.status}>
      <CardContent className="pt-3.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge tone={signal.direction === "long" ? "up" : "down"}>
              {signal.direction === "long" ? "▲ LONG" : "▼ SHORT"}
            </Badge>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {signal.is_test ? <Badge tone="warn">TEST</Badge> : null}
          </div>
          <span
            className={clsx(
              "text-sm font-semibold font-tabular",
              r !== null && r > 0 && "text-up",
              r !== null && r <= 0 && "text-down"
            )}
          >
            {r !== null ? `${fmtR(r)} ${rLabel}` : ""}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="rounded-md bg-muted px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Entry</div>
            <div className="text-sm font-tabular font-medium">{fmtPrice(signal.entry)}</div>
          </div>
          <div className="rounded-md bg-muted px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Stop</div>
            <div className="text-sm font-tabular font-medium">{fmtPrice(signal.stop)}</div>
          </div>
          <div className="rounded-md bg-muted px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</div>
            <div className="text-sm font-tabular font-medium">{fmtPrice(signal.target)}</div>
          </div>
        </div>

        <p className="text-sm text-card-foreground/90 leading-relaxed mt-3">{signal.rationale}</p>

        <div className="text-[11px] text-muted-foreground mt-2 font-tabular space-y-0.5">
          <div>Issued {fmtUtcDateTime(signal.issued_at)}</div>
          {closeEvent ? (
            <div>
              {STATUS_META[signal.status].label.toLowerCase()} at {fmtPrice(closeEvent.price)}
              {closeEvent.price_source ? ` (${closeEvent.price_source})` : ""} ·{" "}
              {fmtUtcDateTime(closeEvent.occurred_at)}
              {closeEvent.note ? ` — ${closeEvent.note}` : ""}
            </div>
          ) : signal.expires_at ? (
            <div>Expires {fmtUtcDateTime(signal.expires_at)}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
