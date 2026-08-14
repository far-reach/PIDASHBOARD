/**
 * The one place the web app gets "the current price" from.
 * Priority: worker-written kv state (freshest, cross-process) → on-demand
 * aggregator fetch (dev / serverless-only deployments) with a short
 * in-process cache. Always returns staleness so the UI can badge honestly.
 */
import { getAggregator } from "@/lib/market/aggregator";
import { getCache } from "@/lib/cache";
import { kvGet } from "@/lib/kv";
import { STALE_AFTER_S, SYMBOL } from "@/lib/env";
import type { ExchangeId, FeedStatus, Tick } from "@/lib/market/types";

export interface LatestPrice {
  symbol: string;
  price: number;
  bid: number | null;
  ask: number | null;
  volume24h: number | null;
  changePct24h: number | null;
  high24h: number | null;
  low24h: number | null;
  source: ExchangeId;
  isFailover: boolean;
  divergencePct: number | null;
  ts: string;
  stalenessS: number;
  isStale: boolean;
}

export interface FeedSnapshotKv {
  tick: Tick;
  isFailover: boolean;
  status: FeedStatus;
}

export const KV_FEED_LATEST = (symbol: string) => `feed:latest:${symbol}`;
export const KV_FEED_STATUS = (symbol: string) => `feed:status:${symbol}`;

function toLatest(tick: Tick, isFailover: boolean, divergencePct: number | null): LatestPrice {
  const stalenessS = Math.max(0, Math.round((Date.now() - tick.ts) / 1000));
  return {
    symbol: tick.symbol,
    price: tick.price,
    bid: tick.bid,
    ask: tick.ask,
    volume24h: tick.volume24h,
    changePct24h: tick.changePct24h,
    high24h: tick.high24h,
    low24h: tick.low24h,
    source: tick.source,
    isFailover,
    divergencePct,
    ts: new Date(tick.ts).toISOString(),
    stalenessS,
    isStale: stalenessS > STALE_AFTER_S,
  };
}

export async function getLatestPrice(symbol: string = SYMBOL): Promise<LatestPrice> {
  // 1) Worker-fed kv state (authoritative when the ingest worker runs).
  try {
    const kv = await kvGet<FeedSnapshotKv>(KV_FEED_LATEST(symbol));
    if (kv && Date.now() - kv.value.tick.ts < STALE_AFTER_S * 1000) {
      return toLatest(kv.value.tick, kv.value.isFailover, kv.value.status.divergencePct);
    }
  } catch {
    // kv unavailable (no db yet) — fall through to on-demand.
  }

  // 2) On-demand with a short cache so bursts of clients share one fetch.
  const cache = await getCache();
  const cacheKey = `ondemand:${symbol}`;
  const cached = await cache.get<LatestPrice>(cacheKey);
  if (cached && Date.now() - new Date(cached.ts).getTime() < 3000) {
    return { ...cached, stalenessS: Math.max(0, Math.round((Date.now() - new Date(cached.ts).getTime()) / 1000)) };
  }

  const agg = getAggregator();
  const { tick, isFailover, status } = await agg.collectTick(symbol);
  const latest = toLatest(tick, isFailover, status.divergencePct);
  await cache.set(cacheKey, latest, 5);
  return latest;
}

export async function getFeedStatus(symbol: string = SYMBOL): Promise<FeedStatus | null> {
  try {
    const kv = await kvGet<FeedStatus>(KV_FEED_STATUS(symbol));
    if (kv) return kv.value;
  } catch {
    /* fall through */
  }
  const agg = getAggregator();
  return agg.feedStatus(null, false);
}
