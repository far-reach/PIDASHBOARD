export type ExchangeId = "okx" | "mexc" | "bitget";

/** Normalized ticker tick. Prices in USDT, timestamps in ms since epoch (UTC). */
export interface Tick {
  symbol: string;
  price: number;
  bid: number | null;
  ask: number | null;
  volume24h: number | null; // quote (USDT) volume where available
  changePct24h: number | null;
  high24h: number | null;
  low24h: number | null;
  source: ExchangeId;
  ts: number;
}

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

export interface Candle {
  ts: number; // open time, ms epoch UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // base volume
}

export interface FundingInfo {
  rate: number; // e.g. 0.0001 = 0.01%
  nextFundingTs: number | null;
  source: ExchangeId;
}

export interface SourceHealth {
  id: ExchangeId;
  ok: boolean;
  lastSuccessTs: number | null;
  lastError: string | null;
  consecutiveFailures: number;
}

export interface FeedStatus {
  activeSource: ExchangeId | null;
  isFailover: boolean;
  sources: SourceHealth[];
  /** abs(primary-secondary)/mid when both fresh; honesty flag when > 1%. */
  divergencePct: number | null;
  updatedAt: string;
}

export interface ExchangeClient {
  id: ExchangeId;
  fetchTicker(symbol: string): Promise<Tick>;
  fetchCandles(symbol: string, tf: Timeframe, limit: number): Promise<Candle[]>;
  fetchFunding?(symbol: string): Promise<FundingInfo | null>;
}
