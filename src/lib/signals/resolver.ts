/**
 * Event resolver (brief §Phase 3.2): watches the live price and appends events
 * to open signals. Each event records the price, source, and timestamp that
 * triggered it. The partial unique indexes make double-resolution impossible
 * even if the ingest worker and a standalone resolver run simultaneously.
 *
 * Lifecycle enforced here:
 *   published → (market trades at entry) → filled → hit_tp | hit_sl | expired
 *             ↘ (entry never trades) ─────────────→ expired, and NOT scored
 *
 * A signal can only hit its target or stop AFTER it has filled. Without that
 * rule a scenario published on the far side of the market would book an
 * instant, arbitrarily large "win" the moment the resolver saw a price beyond
 * its target — a trade nobody could have taken.
 */
import type { Db } from "@/lib/db";
import type { Tick } from "@/lib/market/types";
import { listOpenSignals, insertEvent } from "@/lib/signals/repo";
import { fillsAtPrice, isExpired, resolveAgainstPrice } from "@/lib/signals/outcome";
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
  const occurredAt = new Date(nowMs).toISOString();

  for (const signal of open) {
    // A signal only becomes resolvable once its issue time has passed.
    if (new Date(signal.issuedAt).getTime() > nowMs) continue;

    let filled = signal.filled;

    // 1) Fill leg — record the moment the entry level actually traded.
    if (!filled && fillsAtPrice(signal, tick.price)) {
      try {
        await insertEvent(
          {
            signalId: signal.id,
            type: "filled",
            price: tick.price,
            priceSource: tick.source,
            note: "entry level traded",
            occurredAt,
          },
          db
        );
        results.push({ signalId: signal.id, type: "filled", price: tick.price });
      } catch {
        // Another resolver recorded the fill first.
      }
      filled = true;
    }

    // 2) Terminal leg — only reachable from inside a position.
    let type: SignalEventType | null = filled ? resolveAgainstPrice(signal, tick.price) : null;
    if (type === null && isExpired(signal, nowMs)) {
      type = "expired";
    }
    if (type === null) continue;

    const note =
      type === "expired"
        ? filled
          ? "expiry time reached; closed at market"
          : "expired without the entry ever trading — no position, not scored"
        : `${type === "hit_tp" ? "target" : "stop"} level crossed`;

    try {
      await insertEvent(
        { signalId: signal.id, type, price: tick.price, priceSource: tick.source, note, occurredAt },
        db
      );
      results.push({ signalId: signal.id, type, price: tick.price });
    } catch {
      // Terminal event already exists (another resolver won the race) — fine.
    }
  }
  return results;
}
