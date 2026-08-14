/**
 * Standalone signal resolver — for deployments where the web app runs
 * serverless and the full ingest worker isn't wanted yet. Polls the price
 * and appends terminal events. Safe to run alongside the ingest worker:
 * the DB's partial unique index makes double-resolution impossible.
 * Run: npm run worker:resolve
 */
import { createDb } from "../src/lib/db";
import { getAggregator } from "../src/lib/market/aggregator";
import { resolveOpenSignals } from "../src/lib/signals/resolver";
import { SYMBOL } from "../src/lib/env";

const INTERVAL_MS = Number(process.env.RESOLVE_INTERVAL_MS ?? 10_000);

const log = (level: "info" | "warn" | "error", msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }));

async function main(): Promise<void> {
  const db = await createDb();
  const agg = getAggregator();
  log("info", "resolver starting", { symbol: SYMBOL, intervalMs: INTERVAL_MS });

  const cycle = async () => {
    try {
      const { tick } = await agg.collectTick(SYMBOL);
      const results = await resolveOpenSignals(tick, db);
      for (const r of results) {
        log("info", "signal resolved", { signalId: r.signalId, type: r.type, price: r.price });
      }
    } catch (err) {
      log("error", "resolve cycle failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  await cycle();
  setInterval(() => void cycle(), INTERVAL_MS);
}

main().catch((err) => {
  log("error", "resolver crashed", { error: String(err) });
  process.exit(1);
});
