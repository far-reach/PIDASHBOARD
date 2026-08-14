# Phase 1 Report — Data ingestion + persistence

## What was done

- Postgres schema + migrations in `db/migrations/0001_init.sql`: `signals`,
  `signal_events`, `price_snapshots`, `daily_reports`, `users`, `subscriptions`,
  `payments`, `kv` — with append-only triggers and the one-terminal-event unique index.
- DB adapter (`src/lib/db.ts`): production Postgres via `DATABASE_URL`; embedded PGlite
  (real Postgres/WASM) for dev + tests, so triggers and SQL are identical everywhere.
- Ingestion worker (`workers/ingest.ts`): OKX websocket stream + REST polling with
  MEXC failover, snapshot writes, hot feed state via `kv`, inline signal resolution,
  hourly snapshot pruning, JSON-line logs, graceful shutdown.
- Failover logic in `src/lib/market/aggregator.ts`: priority promotion, health tracking,
  automatic recovery, `is_failover` flag, cross-exchange divergence flag.
- `/api/price/latest` returning `{price, bid, ask, source, ts, staleness_s, ...}` with
  worker-state-first / on-demand-fallback sourcing.
- Idempotent daily report generator (`src/lib/reports/daily.ts`): exactly one row per
  (symbol, date), `ON CONFLICT DO NOTHING`, OHLC + notable hourly moves + key levels +
  volume-anomaly flag + funding context, conditional model-based language.
- Report worker (`workers/report.ts`): one-shot, `--date`, and 00:05-UTC loop modes.
- `/api/health` with per-subsystem status (db, cache, feed freshness, report recency).

## Numbers / verification

- Failover exercised in `test/failover.test.ts` (6 scenarios: promote, flag, recover,
  all-down, WS-preference, divergence) — kill-the-primary is simulated by a throwing
  client; all pass.
- Report idempotency proven in `test/report-idempotency.test.ts` against the real
  schema (re-run → `created=false`, duplicate insert → 1 row).
- Report content hand-verified in `test/report.test.ts` (+12.00% change, 1.5x volume
  flag, best/worst hour identification — all hand-computed fixtures).

## What surprised me

- PGlite's extended-query protocol rejects multi-statement scripts; the adapter routes
  no-param queries through `exec()` (migrations) and params through prepared statements.

## Known limitations / open questions

- **The 24-hour continuous-ingestion exit criterion cannot be met in this build
  sandbox**: outbound requests to exchange APIs are blocked by the environment proxy
  (verified: HTTP 403 CONNECT). The worker + failover are fully unit-tested against
  simulated sources; the soak test must run on the deployed worker (checklist in
  PHASE_5_REPORT).
- Chart/report candles currently come from exchange REST (with failover), not from own
  snapshots; snapshots accumulate for future self-sufficiency.

## Recommendation

Proceed to Phase 2 (done). Deployment owner: run the 24h soak on Railway/Fly and paste
the health-endpoint evidence here.
