import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCache } from "@/lib/cache";
import { kvGet } from "@/lib/kv";
import { KV_FEED_LATEST } from "@/lib/feed";
import { monetizationMode, STALE_AFTER_S, SYMBOL } from "@/lib/env";
import type { FeedSnapshotKv } from "@/lib/feed";

export const dynamic = "force-dynamic";

type SubsystemState = "ok" | "degraded" | "down";

interface Subsystem {
  status: SubsystemState;
  detail: string;
}

/**
 * GET /api/health — brief §4 Monitoring: DB reachable, cache reachable,
 * exchange feed fresh, latest report present.
 */
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
      detail: err instanceof Error ? err.message : "unreachable",
    };
  }

  // Cache
  try {
    const cache = await getCache();
    await cache.set("health:probe", 1, 5);
    subsystems.cache = { status: "ok", detail: cache.kind };
  } catch (err) {
    subsystems.cache = { status: "degraded", detail: err instanceof Error ? err.message : "error" };
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
      subsystems.feed = {
        status: "degraded",
        detail: "no ingest worker state; web serves prices on-demand",
      };
    }
  } catch (err) {
    subsystems.feed = { status: "down", detail: err instanceof Error ? err.message : "error" };
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
    subsystems.reports = { status: "down", detail: err instanceof Error ? err.message : "error" };
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
