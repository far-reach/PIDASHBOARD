/**
 * Pure outcome math. Everything the performance page shows is derived from
 * the immutable event log through these functions — there is no stored,
 * editable "result" anywhere (brief §3.2).
 */
import {
  TERMINAL_EVENTS,
  type Direction,
  type SignalEventRow,
  type SignalRow,
  type SignalStatus,
  type SignalWithOutcome,
} from "@/lib/signals/types";

/**
 * Realized R multiple: profit measured in units of initial risk.
 * risk = |entry - stop|. A stop-out at exactly the stop is -1R; a take-profit
 * at exactly the target is +(reward/risk)R. Actual event prices are used, so
 * overshoot/slippage shows honestly.
 */
export function computeR(
  direction: Direction,
  entry: number,
  stop: number,
  exitPrice: number
): number {
  const risk = Math.abs(entry - stop);
  if (risk === 0) return 0;
  const signed = direction === "long" ? exitPrice - entry : entry - exitPrice;
  return signed / risk;
}

/** Nominal reward-to-risk of the setup as issued (e.g. 2.0 = "2R target"). */
export function rewardRiskRatio(signal: Pick<SignalRow, "direction" | "entry" | "stop" | "target">): number {
  const risk = Math.abs(signal.entry - signal.stop);
  if (risk === 0) return 0;
  return Math.abs(signal.target - signal.entry) / risk;
}

export function terminalEvent(events: SignalEventRow[]): SignalEventRow | null {
  // The DB guarantees at most one; take the earliest defensively.
  const terminals = events
    .filter((e) => (TERMINAL_EVENTS as string[]).includes(e.type))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return terminals[0] ?? null;
}

export function deriveOutcome(signal: SignalRow, events: SignalEventRow[]): SignalWithOutcome {
  const term = terminalEvent(events);
  const status: SignalStatus = term ? (term.type as SignalStatus) : "open";
  let r: number | null = null;
  let exitPrice: number | null = null;
  if (term && term.price !== null && Number.isFinite(term.price)) {
    exitPrice = term.price;
    r = computeR(signal.direction, signal.entry, signal.stop, term.price);
  }
  return {
    ...signal,
    events: [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    status,
    r,
    exitPrice,
    closedAt: term ? term.occurredAt : null,
  };
}

/** Unrealized R for an open signal at the current price (display only). */
export function unrealizedR(signal: SignalRow, currentPrice: number): number {
  return computeR(signal.direction, signal.entry, signal.stop, currentPrice);
}

/**
 * Given a live price, decide whether an open signal must close.
 * Conservative single-price rule: stop is checked BEFORE target, so a tick
 * that somehow satisfies both books the loss, never the win.
 */
export function resolveAgainstPrice(
  signal: Pick<SignalRow, "direction" | "stop" | "target">,
  price: number
): "hit_sl" | "hit_tp" | null {
  if (signal.direction === "long") {
    if (price <= signal.stop) return "hit_sl";
    if (price >= signal.target) return "hit_tp";
  } else {
    if (price >= signal.stop) return "hit_sl";
    if (price <= signal.target) return "hit_tp";
  }
  return null;
}

export function isExpired(signal: Pick<SignalRow, "expiresAt">, nowMs: number): boolean {
  return signal.expiresAt !== null && new Date(signal.expiresAt).getTime() <= nowMs;
}
