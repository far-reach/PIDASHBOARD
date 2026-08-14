/**
 * MEXC public market data (v1 secondary source — see DATA_SOURCES.md).
 * Docs: https://mexcdevelop.github.io/apidocs/spot_v3_en/
 * Spot symbol: PIUSDT. REST polling (MEXC's v3 WebSocket requires protobuf;
 * REST at the ingest interval is sufficient for a failover source — see
 * DATA_SOURCES.md "WebSocket status").
 */
import { fetchJson } from "@/lib/market/http";
import type { Candle, ExchangeClient, Tick, Timeframe } from "@/lib/market/types";

const BASE = process.env.MEXC_API_BASE ?? "https://api.mexc.com";

const TF_MAP: Record<Timeframe, string> = { "1m": "1m", "5m": "5m", "1h": "60m", "1d": "1d" };

interface Mexc24h {
  lastPrice: string;
  bidPrice?: string;
  askPrice?: string;
  quoteVolume: string;
  priceChangePercent: string; // fraction on MEXC (e.g. "0.0123")
  highPrice: string;
  lowPrice: string;
  closeTime?: number;
}

export const mexc: ExchangeClient = {
  id: "mexc",

  async fetchTicker(symbol: string): Promise<Tick> {
    const t = await fetchJson<Mexc24h>(`${BASE}/api/v3/ticker/24hr?symbol=${symbol}`);
    const last = Number(t.lastPrice);
    if (!Number.isFinite(last) || last <= 0) throw new Error(`mexc: empty ticker for ${symbol}`);
    return {
      symbol,
      price: last,
      bid: Number(t.bidPrice) || null,
      ask: Number(t.askPrice) || null,
      volume24h: Number(t.quoteVolume) || null,
      changePct24h: Number.isFinite(Number(t.priceChangePercent))
        ? Number(t.priceChangePercent) * 100
        : null,
      high24h: Number(t.highPrice) || null,
      low24h: Number(t.lowPrice) || null,
      source: "mexc",
      ts: Date.now(),
    };
  },

  async fetchCandles(symbol: string, tf: Timeframe, limit: number): Promise<Candle[]> {
    // [openTime, open, high, low, close, volume(base), closeTime, quoteVolume]
    const rows = await fetchJson<(string | number)[][]>(
      `${BASE}/api/v3/klines?symbol=${symbol}&interval=${TF_MAP[tf]}&limit=${Math.min(limit, 500)}`
    );
    if (!Array.isArray(rows)) throw new Error("mexc: bad klines response");
    return rows
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
