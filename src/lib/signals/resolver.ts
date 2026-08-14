/**
 * Event resolver (brief §Phase 3.2): watches the live price and appends
 * terminal events (hit_tp / hit_sl / expired) to open signals. Each event
 * records the price, source, and timestamp that triggered it. The partial
 * unique index makes double-resolution impossible even if the ingest worker
 * and a standalone resolver run simultaneously.
 */
import type { Db } from "@/lib/db";
import type { Tick } from "@/lib/market/types";
import { listOpenSignals, insertEvent } from "@/lib/signals/repo";
import { isExpired, resolveAgainstPrice } from "@/lib/signals/outcome";
import type { SignalEventType } from "@/lib/signals/types";

export interface ResolutionResult {
  signalId: string;
  type: SignalEventType;
  price: number;
}

export async function resolveOpenSignals(tick: Tick, db?: Db): Promise<ResolutionResult[]> {
  const open = await listOpenSignals(tick.symbol, db);
  const results: ResolutionResult[] = [];
  const nowMs = tick.ts;

  for (const signal of open) {
    // A signal only becomes resolvable once its issue time has passed.
    if (new Date(signal.issuedAt).getTime() > nowMs) continue;

    let type: SignalEventType | null = resolveAgainstPrice(signal, tick.price);
    if (type === null && isExpired(signal, nowMs)) {
      type = "expired";
    }
    if (type === null) continue;

    try {
      await insertEvent(
        {
          signalId: signal.id,
          type,
          price: tick.price,
          priceSource: tick.source,
          note:
            type === "expired"
              ? "expiry time reached; closed at market"
              : `${type === "hit_tp" ? "target" : "stop"} level crossed`,
          occurredAt: new Date(nowMs).toISOString(),
        },
        db
      );
      results.push({ signalId: signal.id, type, price: tick.price });
    } catch {
      // Terminal event already exists (another resolver won the race) — fine.
    }
  }
  return results;
}
