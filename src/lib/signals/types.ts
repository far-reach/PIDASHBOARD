export type Direction = "long" | "short";

export type SignalEventType =
  | "published"
  | "filled"
  | "hit_tp"
  | "hit_sl"
  | "expired"
  | "manual_close";

/** Terminal = the signal is closed; exactly one per signal, enforced in the DB. */
export const TERMINAL_EVENTS: SignalEventType[] = ["hit_tp", "hit_sl", "expired", "manual_close"];

export type SignalStatus = "open" | "hit_tp" | "hit_sl" | "expired" | "manual_close";

export interface SignalRow {
  id: string;
  symbol: string;
  direction: Direction;
  entry: number;
  stop: number;
  target: number;
  rationale: string;
  issuedAt: string;
  expiresAt: string | null;
  visibleFrom: string | null;
  source: "manual" | "engine" | "seed";
  isTest: boolean;
  createdAt: string;
}

export interface SignalEventRow {
  id: string;
  signalId: string;
  type: SignalEventType;
  price: number | null;
  priceSource: string | null;
  note: string;
  occurredAt: string;
}

export interface SignalWithOutcome extends SignalRow {
  events: SignalEventRow[];
  status: SignalStatus;
  /**
   * Realized R multiple. NULL when the signal was never filled — a scenario
   * whose entry price never traded was never a position, so scoring it as a
   * win or a loss would misrepresent the record.
   */
  r: number | null;
  exitPrice: number | null;
  closedAt: string | null;
  /** True once the market traded at or through the entry level. */
  filled: boolean;
  filledAt: string | null;
}
