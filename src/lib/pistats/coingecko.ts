/**
 * CoinGecko client for PI network-level figures the exchange feeds cannot
 * provide: circulating / total / max supply, market cap, FDV, global volume.
 *
 * Free-tier discipline, by design rather than hope:
 *   - ONE upstream call serves every user; results are cached in the shared
 *     kv table for CACHE_TTL_S, so traffic to us never multiplies traffic to
 *     CoinGecko. At one refresh per 10 minutes the monthly ceiling is ~4.3k
 *     calls against a 10k free quota.
 *   - `COINGECKO_API_KEY` (their free "demo" key) is optional; without it the
 *     public keyless endpoint is used. Both are attributed in the UI
 *     ("Market data: CoinGecko"), which their free terms require.
 *
 * Compliance note (COMPLIANCE.md): everything served from here is a factual,
 * attributed, timestamped observation. No projections, no targets.
 */
import { z } from "zod";

const COINGECKO_BASE = process.env.COINGECKO_API_BASE ?? "https://api.coingecko.com/api/v3";
const COIN_ID = process.env.COINGECKO_COIN_ID ?? "pi-network";

const marketDataSchema = z.object({
  market_data: z.object({
    circulating_supply: z.number().nullable(),
    total_supply: z.number().nullable(),
    max_supply: z.number().nullable(),
    market_cap: z.object({ usd: z.number().optional() }),
    fully_diluted_valuation: z.object({ usd: z.number().optional() }),
    total_volume: z.object({ usd: z.number().optional() }),
    current_price: z.object({ usd: z.number().optional() }),
    price_change_percentage_24h: z.number().nullable(),
    ath: z.object({ usd: z.number().optional() }),
    ath_date: z.object({ usd: z.string().optional() }),
  }),
  last_updated: z.string(),
});

export interface PiSupplyStats {
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  /** circulating / max, as a 0-100 percentage, when both are known. */
  circulatingPctOfMax: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  priceUsd: number | null;
  changePct24h: number | null;
  athUsd: number | null;
  athDate: string | null;
  source: "coingecko";
  asOf: string;
}

export async function fetchPiSupplyStats(): Promise<PiSupplyStats> {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.COINGECKO_API_KEY;
  if (key) headers["x-cg-demo-api-key"] = key;

  const url =
    `${COINGECKO_BASE}/coins/${COIN_ID}` +
    `?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
  const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`coingecko ${res.status} on /coins/${COIN_ID}`);
  }
  const parsed = marketDataSchema.parse(await res.json());
  const m = parsed.market_data;

  const circulating = numOrNull(m.circulating_supply);
  const max = numOrNull(m.max_supply);
  return {
    circulatingSupply: circulating,
    totalSupply: numOrNull(m.total_supply),
    maxSupply: max,
    circulatingPctOfMax:
      circulating !== null && max !== null && max > 0 ? (circulating / max) * 100 : null,
    marketCapUsd: numOrNull(m.market_cap.usd),
    fdvUsd: numOrNull(m.fully_diluted_valuation.usd),
    volume24hUsd: numOrNull(m.total_volume.usd),
    priceUsd: numOrNull(m.current_price.usd),
    changePct24h: numOrNull(m.price_change_percentage_24h),
    athUsd: numOrNull(m.ath.usd),
    athDate: m.ath_date.usd ?? null,
    source: "coingecko",
    asOf: parsed.last_updated,
  };
}

function numOrNull(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
