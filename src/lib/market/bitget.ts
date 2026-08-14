/**
 * Bitget public market data (v1 tertiary — cross-check only, never promoted
 * to the price feed; see DATA_SOURCES.md).
 * Docs: https://www.bitget.com/api-doc/spot/market/Get-Tickers
 */
import { fetchJson } from "@/lib/market/http";
import type { Candle, ExchangeClient, Tick, Timeframe } from "@/lib/market/types";

const BASE = process.env.BITGET_API_BASE ?? "https://api.bitget.com";

const TF_MAP: Record<Timeframe, string> = { "1m": "1min", "5m": "5min", "1h": "1h", "1d": "1day" };

interface BitgetTicker {
  lastPr: string;
  bidPr: string;
  askPr: string;
  quoteVolume: string;
  high24h: string;
  low24h: string;
  change24h: string; // fraction
  ts: string;
}

export const bitget: ExchangeClient = {
  id: "bitget",

  async fetchTicker(symbol: string): Promise<Tick> {
    const res = await fetchJson<{ code: string; data: BitgetTicker[] }>(
      `${BASE}/api/v2/spot/market/tickers?symbol=${symbol}`
    );
    const t = res.data?.[0];
    if (res.code !== "00000" || !t) throw new Error(`bitget: empty ticker for ${symbol}`);
    const last = Number(t.lastPr);
    return {
      symbol,
      price: last,
      bid: Number(t.bidPr) || null,
      ask: Number(t.askPr) || null,
      volume24h: Number(t.quoteVolume) || null,
      changePct24h: Number.isFinite(Number(t.change24h)) ? Number(t.change24h) * 100 : null,
      high24h: Number(t.high24h) || null,
      low24h: Number(t.low24h) || null,
      source: "bitget",
      ts: Number(t.ts) || Date.now(),
    };
  },

  async fetchCandles(symbol: string, tf: Timeframe, limit: number): Promise<Candle[]> {
    const res = await fetchJson<{ code: string; data: string[][] }>(
      `${BASE}/api/v2/spot/market/candles?symbol=${symbol}&granularity=${TF_MAP[tf]}&limit=${Math.min(limit, 300)}`
    );
    if (res.code !== "00000" || !Array.isArray(res.data)) {
      throw new Error("bitget: bad candles response");
    }
    // [ts, open, high, low, close, baseVol, quoteVol, usdtVol] oldest→newest
    return res.data
      .map((row) => ({
        ts: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
      }))
      .filter((c) => Number.isFinite(c.close));
  },
};
