/**
 * OKX public market data (v1 primary source — see DATA_SOURCES.md).
 * Docs: https://www.okx.com/docs-v5/en/  (public endpoints, no key needed)
 * Spot instrument: PI-USDT; perp (funding context): PI-USDT-SWAP.
 */
import { fetchJson, optionalNumber, requirePrice } from "@/lib/market/http";
import type { Candle, ExchangeClient, FundingInfo, Tick, Timeframe } from "@/lib/market/types";

const BASE = process.env.OKX_API_BASE ?? "https://www.okx.com";

function instId(symbol: string): string {
  // "PIUSDT" → "PI-USDT"
  return symbol.replace(/USDT$/, "-USDT");
}

const TF_MAP: Record<Timeframe, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1Dutc", "1w": "1Wutc" };

interface OkxTicker {
  last: string;
  bidPx: string;
  askPx: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCcy24h: string; // quote volume for spot
  ts: string;
}

export const okx: ExchangeClient & {
  fetchFunding(symbol: string): Promise<FundingInfo | null>;
  fetchFundingHistory(symbol: string, limit?: number): Promise<{ rate: number; ts: number }[]>;
} = {
  id: "okx",

  async fetchTicker(symbol: string): Promise<Tick> {
    const res = await fetchJson<{ code: string; data: OkxTicker[] }>(
      `${BASE}/api/v5/market/ticker?instId=${instId(symbol)}`
    );
    const t = res.data?.[0];
    if (res.code !== "0" || !t) throw new Error(`okx: empty ticker for ${symbol}`);
    const last = requirePrice(t.last, "okx ticker");
    const open = Number(t.open24h);
    return {
      symbol,
      price: last,
      bid: optionalNumber(t.bidPx),
      ask: optionalNumber(t.askPx),
      volume24h: optionalNumber(t.volCcy24h),
      changePct24h: Number.isFinite(open) && open > 0 ? ((last - open) / open) * 100 : null,
      high24h: optionalNumber(t.high24h),
      low24h: optionalNumber(t.low24h),
      source: "okx",
      ts: Number(t.ts) || Date.now(),
    };
  },

  async fetchCandles(symbol: string, tf: Timeframe, limit: number): Promise<Candle[]> {
    const res = await fetchJson<{ code: string; data: string[][] }>(
      `${BASE}/api/v5/market/candles?instId=${instId(symbol)}&bar=${TF_MAP[tf]}&limit=${Math.min(limit, 300)}`
    );
    if (res.code !== "0" || !Array.isArray(res.data)) throw new Error("okx: bad candles response");
    // OKX returns newest first: [ts, o, h, l, c, vol(base), volCcy, ...]
    return res.data
      .map((row) => ({
        ts: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      }))
      .filter((c) => Number.isFinite(c.close))
      .reverse();
  },

  async fetchFunding(symbol: string): Promise<FundingInfo | null> {
    try {
      const res = await fetchJson<{
        code: string;
        data: { fundingRate: string; nextFundingTime: string }[];
      }>(`${BASE}/api/v5/public/funding-rate?instId=${instId(symbol)}-SWAP`);
      const f = res.data?.[0];
      if (res.code !== "0" || !f) return null;
      return {
        rate: Number(f.fundingRate),
        nextFundingTs: Number(f.nextFundingTime) || null,
        source: "okx",
      };
    } catch {
      return null; // no perp listed / endpoint down → funding context simply absent
    }
  },

  /** Settled funding rates, oldest first. Empty when no perp is listed. */
  async fetchFundingHistory(symbol: string, limit = 24): Promise<{ rate: number; ts: number }[]> {
    try {
      const res = await fetchJson<{
        code: string;
        data: { fundingRate: string; fundingTime: string }[];
      }>(
        `${BASE}/api/v5/public/funding-rate-history?instId=${instId(symbol)}-SWAP&limit=${Math.min(limit, 100)}`
      );
      if (res.code !== "0" || !Array.isArray(res.data)) return [];
      return res.data
        .map((f) => ({ rate: Number(f.fundingRate), ts: Number(f.fundingTime) }))
        .filter((f) => Number.isFinite(f.rate) && Number.isFinite(f.ts))
        .reverse();
    } catch {
      return [];
    }
  },
};
