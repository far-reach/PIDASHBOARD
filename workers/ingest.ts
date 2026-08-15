/**
 * Always-on ingestion worker (brief §Phase 1.2-1.3, 1.6).
 *   - OKX websocket ticker stream feeds the aggregator for sub-second freshness
 *   - REST polling every INGEST_INTERVAL_MS is the safety net + secondary source
 *   - each cycle: write a price_snapshots row (cold), update kv feed state (hot),
 *     resolve open signals against the live price
 *   - hourly: prune snapshots beyond the retention window
 * Run: npm run worker:ingest   (Railway / Fly.io / any always-on Node host)
 */
import { createDb } from "../src/lib/db";
import { getAggregator } from "../src/lib/market/aggregator";
import { streamOkxTicker } from "../src/lib/market/okx-ws";
import { resolveOpenSignals } from "../src/lib/signals/resolver";
import { KV_FEED_LATEST, KV_FEED_STATUS } from "../src/lib/feed";
import { INGEST_INTERVAL_MS, SNAPSHOT_RETENTION_DAYS, SYMBOL } from "../src/lib/env";

const log = (level: "info" | "warn" | "error", msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }));

async function main(): Promise<void> {
  const db = await createDb();
  const agg = getAggregator();
  const symbol = SYMBOL;
  let cycles = 0;
  let lastPrune = 0;
  let stopping = false;

  log("info", "ingest worker starting", { symbol, intervalMs: INGEST_INTERVAL_MS });

  const ws = streamOkxTicker(
    symbol,
    (tick) => agg.pushTick(tick),
    (msg) => log("info", msg)
  );

  const kvSet = async (k: string, v: unknown) => {
    await db.query(
      `INSERT INTO kv (k, v, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = now()`,
      [k, JSON.stringify(v)]
    );
  };

  const cycle = async () => {
    try {
      const { tick, isFailover, status } = await agg.collectTick(symbol);

      await db.query(
        `INSERT INTO price_snapshots (symbol, price, bid, ask, volume_24h, source, is_failover, ts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          symbol,
          tick.price,
          tick.bid,
          tick.ask,
          tick.volume24h,
          tick.source,
          isFailover,
          new Date(tick.ts).toISOString(),
        ]
      );
      await kvSet(KV_FEED_LATEST(symbol), { tick, isFailover, status });
      await kvSet(KV_FEED_STATUS(symbol), status);

      const resolutions = await resolveOpenSignals(tick, db);
      for (const r of resolutions) {
        log("info", "signal resolved", { signalId: r.signalId, type: r.type, price: r.price });
      }

      if (isFailover) {
        log("warn", "serving from failover source", { source: tick.source });
      }
      if (agg.isDiverged()) {
        log("warn", "cross-exchange divergence above 1%", { divergencePct: agg.divergencePct() });
      }

      cycles++;
      if (cycles % 60 === 0) {
        log("info", "heartbeat", { cycles, source: tick.source, price: tick.price });
      }

      if (Date.now() - lastPrune > 3600_000) {
        lastPrune = Date.now();
        await db.query(
          `DELETE FROM price_snapshots WHERE ts < now() - ($1 || ' days')::interval`,
          [String(SNAPSHOT_RETENTION_DAYS)]
        );
        log("info", "pruned old snapshots", { retentionDays: SNAPSHOT_RETENTION_DAYS });
      }
    } catch (err) {
      log("error", "ingest cycle failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Guard against overlap: if a DB or exchange stall makes a cycle take longer
  // than the interval, plain setInterval would keep launching new ones and pile
  // up unbounded concurrent work on an already-struggling dependency.
  let cycleRunning = false;
  const runGuarded = async () => {
    if (cycleRunning) {
      log("warn", "previous ingest cycle still running; skipping this tick");
      return;
    }
    cycleRunning = true;
    try {
      await cycle();
    } finally {
      cycleRunning = false;
    }
  };

  await runGuarded();
  const timer = setInterval(() => void runGuarded(), INGEST_INTERVAL_MS);

  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    log("info", "shutting down");
    clearInterval(timer);
    ws.close();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  log("error", "ingest worker crashed", { error: err instanceof Error ? err.stack : String(err) });
  process.exit(1);
});
