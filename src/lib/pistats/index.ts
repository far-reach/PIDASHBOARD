/**
 * Network-stats aggregation: cached CoinGecko figures + the app's own daily
 * supply snapshots (see db/migrations/0004). The cache is the shared kv table,
 * so one upstream fetch serves every user across all serverless instances.
 */
import { getDb, toIso } from "@/lib/db";
import { kvGet, kvSet } from "@/lib/kv";
import { fetchPiSupplyStats, type PiSupplyStats } from "@/lib/pistats/coingecko";

export const KV_PI_STATS = "pistats:latest";
/** One upstream call per 10 minutes, shared by all users (~4.3k/month). */
const CACHE_TTL_S = 600;

export interface SupplySnapshot {
  date: string;
  circulatingSupply: number | null;
  marketCapUsd: number | null;
}

export interface PiStatsPayload {
  stats: PiSupplyStats | null;
  /** Daily observations, oldest first; the self-built supply history. */
  history: SupplySnapshot[];
  cached: boolean;
  asOf: string;
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Record today's snapshot if it does not exist yet. Insert-only: a day's row
 * is never updated, so the history is an append-only record of observations.
 */
async function snapshotIfNew(stats: PiSupplyStats): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO supply_snapshots
       (snapshot_date, circulating_supply, total_supply, max_supply, market_cap_usd, volume_24h_usd, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (snapshot_date) DO NOTHING`,
    [
      utcToday(),
      stats.circulatingSupply,
      stats.totalSupply,
      stats.maxSupply,
      stats.marketCapUsd,
      stats.volume24hUsd,
      stats.source,
    ]
  );
}

async function readHistory(days: number): Promise<SupplySnapshot[]> {
  const db = await getDb();
  const { rows } = await db.query<{
    snapshot_date: unknown;
    circulating_supply: string | number | null;
    market_cap_usd: string | number | null;
  }>(
    `SELECT snapshot_date, circulating_supply, market_cap_usd
     FROM supply_snapshots ORDER BY snapshot_date DESC LIMIT $1`,
    [days]
  );
  return rows
    .map((r) => ({
      date: toIso(r.snapshot_date).slice(0, 10),
      circulatingSupply: r.circulating_supply === null ? null : Number(r.circulating_supply),
      marketCapUsd: r.market_cap_usd === null ? null : Number(r.market_cap_usd),
    }))
    .reverse();
}

export async function getPiStats(): Promise<PiStatsPayload> {
  // Serve from the shared cache when fresh.
  try {
    const kv = await kvGet<PiSupplyStats>(KV_PI_STATS);
    if (kv && Date.now() - new Date(kv.updatedAt).getTime() < CACHE_TTL_S * 1000) {
      return {
        stats: kv.value,
        history: await readHistory(90),
        cached: true,
        asOf: kv.updatedAt,
      };
    }
  } catch {
    // kv unavailable; fall through to a direct fetch.
  }

  try {
    const stats = await fetchPiSupplyStats();
    await Promise.allSettled([kvSet(KV_PI_STATS, stats), snapshotIfNew(stats)]);
    return { stats, history: await readHistory(90), cached: false, asOf: new Date().toISOString() };
  } catch {
    // Upstream down: serve the stale cache if any exists; with its honest
    // timestamp; rather than nothing. Degradation over disappearance.
    try {
      const kv = await kvGet<PiSupplyStats>(KV_PI_STATS);
      if (kv) {
        return { stats: kv.value, history: await readHistory(90), cached: true, asOf: kv.updatedAt };
      }
    } catch {
      /* fall through */
    }
    return { stats: null, history: await readHistory(90), cached: false, asOf: new Date().toISOString() };
  }
}
