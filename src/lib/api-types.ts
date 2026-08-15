/** Shapes returned by our own API routes (client-side view of the wire format). */

export interface LatestPriceDTO {
  symbol: string;
  price: number;
  bid: number | null;
  ask: number | null;
  volume_24h: number | null;
  change_pct_24h: number | null;
  high_24h: number | null;
  low_24h: number | null;
  source: string;
  is_failover: boolean;
  divergence_pct: number | null;
  ts: string;
  staleness_s: number;
  is_stale: boolean;
}

export interface CandleDTO {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlesResponse {
  symbol: string;
  tf: string;
  source: string;
  is_failover: boolean;
  as_of: string;
  candles: CandleDTO[];
}

export interface SignalEventDTO {
  type: "published" | "filled" | "hit_tp" | "hit_sl" | "expired" | "manual_close";
  price: number | null;
  price_source: string | null;
  note: string;
  occurred_at: string;
}

export interface SignalDTO {
  id: string;
  symbol: string;
  direction: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  rationale: string;
  issued_at: string;
  created_at?: string;
  expires_at: string | null;
  status: "open" | "hit_tp" | "hit_sl" | "expired" | "manual_close";
  r: number | null;
  exit_price: number | null;
  closed_at: string | null;
  unrealized_r: number | null;
  filled?: boolean;
  filled_at?: string | null;
  is_test?: boolean;
  events: SignalEventDTO[];
}

export interface SignalsResponse {
  signals: SignalDTO[];
  meta: {
    symbol: string;
    monetization: "free" | "freemium";
    open_signals_visible: boolean;
    hidden_open_count: number;
    current_price: number | null;
    price_as_of: string | null;
    as_of: string;
  };
}

export interface PerformanceResponse {
  symbol: string;
  performance: {
    totalSignals: number;
    openSignals: number;
    closedSignals: number;
    scored: number;
    wins: number;
    losses: number;
    winRatePct: number | null;
    avgR: number | null;
    sumR: number;
    bestR: number | null;
    worstR: number | null;
    maxDrawdownR: number;
    currentStreak: number;
    equityCurve: { ts: string; cumR: number }[];
    monthly: { month: string; n: number; wins: number; losses: number; sumR: number }[];
    histogram: { from: number; to: number; label: string; count: number }[];
    computedAt: string;
  };
}

export interface ReportDTO {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  change_pct: number | null;
  volume: number | null;
  content_md: string;
  generated_at: string;
}

export interface ReportsResponse {
  reports: ReportDTO[];
  symbol: string;
}

export interface MeResponse {
  user: { uid: string; username: string } | null;
  subscription: { active: boolean; plan: string | null; expiresAt: string | null };
  monetization: "free" | "freemium";
}
