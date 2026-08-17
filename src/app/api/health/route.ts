import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCache } from "@/lib/cache";
import { kvGet } from "@/lib/kv";
import { getLatestPrice, KV_FEED_LATEST } from "@/lib/feed";
import { monetizationMode, STALE_AFTER_S, SYMBOL } from "@/lib/env";
import type { FeedSnapshotKv } from "@/lib/feed";

export const dynamic = "force-dynamic";

type SubsystemState = "ok" | "degraded" | "down";

interface Subsystem {
  status: SubsystemState;
  detail: string;
}

/**
 * GET /api/health; brief §4 Monitoring: DB reachable, cache reachable,
 * exchange feed fresh, latest report present.
 */
/**
 * Internal error strings can carry connection strings, hostnames and driver
 * internals. The health endpoint is public (uptime monitors need it), so the
 * detail is redacted in production while the status stays truthful; the full
 * error still goes to the logs.
 */
function detailOf(err: unknown, fallback: string): string {
  if (process.env.NODE_ENV === "production") return fallback;
  return err instanceof Error ? err.message : String(err);
}

export async function GET(): Promise<NextResponse> {
  const subsystems: Record<string, Subsystem> = {};

  // Database
  try {
    const db = await getDb();
    await db.query(`SELECT 1`);
    subsystems.database = { status: "ok", detail: db.kind };
  } catch (err) {
    subsystems.database = {
      status: "down",
      detail: detailOf(err, "unreachable"),
    };
  }

  // Cache. The Redis adapter deliberately swallows errors so a cache outage
  // never breaks a request path; which means "set() did not throw" proves
  // nothing. Probe with a round-trip instead, so an unreachable Redis is
  // reported as degraded rather than silently green.
  try {
    const cache = await getCache();
    const probe = `health:probe:${Date.now()}`;
    await cache.set(probe, "ok", 5);
    const readBack = await cache.get<string>(probe);
    subsystems.cache =
      readBack === "ok"
        ? { status: "ok", detail: cache.kind }
        : {
            status: "degraded",
            detail: `${cache.kind} did not return the probe value; serving without cache`,
          };
  } catch (err) {
    subsystems.cache = { status: "degraded", detail: detailOf(err, "cache error") };
  }

  // Feed freshness: worker-written kv first, snapshots as fallback evidence.
  try {
    const kv = await kvGet<FeedSnapshotKv>(KV_FEED_LATEST(SYMBOL));
    if (kv) {
      const ageS = Math.round((Date.now() - kv.value.tick.ts) / 1000);
      subsystems.feed = {
        status: ageS <= STALE_AFTER_S ? "ok" : ageS <= STALE_AFTER_S * 5 ? "degraded" : "down",
        detail: `source=${kv.value.tick.source} age=${ageS}s failover=${kv.value.isFailover}`,
      };
    } else {
      // No worker state. That is the NORMAL shape of a serverless-only
      // deployment, not a fault: the web app fetches on demand. Reporting it as
      // degraded forever would train the operator to ignore this endpoint, so
      // prove the on-demand path instead and judge it on the same freshness
      // rule the worker path uses.
      const latest = await getLatestPrice(SYMBOL);
      subsystems.feed = {
        status: latest.isStale ? "degraded" : "ok",
        detail:
          `on-demand (no ingest worker) source=${latest.source} ` +
          `age=${latest.stalenessS}s failover=${latest.isFailover}`,
      };
    }
  } catch (err) {
    subsystems.feed = { status: "down", detail: detailOf(err, "feed state unreadable") };
  }

  // Latest daily report
  try {
    const db = await getDb();
    const { rows } = await db.query<{ report_date: unknown }>(
      `SELECT report_date FROM daily_reports WHERE symbol = $1 ORDER BY report_date DESC LIMIT 1`,
      [SYMBOL]
    );
    if (rows[0]) {
      const latest = String(
        rows[0].report_date instanceof Date
          ? rows[0].report_date.toISOString().slice(0, 10)
          : rows[0].report_date
      ).slice(0, 10);
      const ageDays = Math.floor(
        (Date.now() - Date.parse(`${latest}T00:00:00Z`)) / (24 * 3600 * 1000)
      );
      subsystems.reports = {
        status: ageDays <= 2 ? "ok" : "degraded",
        detail: `latest=${latest}`,
      };
    } else {
      subsystems.reports = { status: "degraded", detail: "no reports generated yet" };
    }
  } catch (err) {
    subsystems.reports = { status: "down", detail: detailOf(err, "report state unreadable") };
  }

  const states = Object.values(subsystems).map((s) => s.status);
  const overall: SubsystemState = states.includes("down")
    ? "down"
    : states.includes("degraded")
      ? "degraded"
      : "ok";

  return NextResponse.json(
    {
      status: overall,
      symbol: SYMBOL,
      monetization: monetizationMode(),
      subsystems,
      ts: new Date().toISOString(),
    },
    { status: overall === "down" ? 503 : 200 }
  );
}
