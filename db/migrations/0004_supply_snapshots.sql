-- ── Supply snapshots ────────────────────────────────────────────────────────
--
-- One row per UTC day recording PI's supply figures as reported by the
-- upstream market-data source at capture time. Third parties publish unlock
-- *projections*, but none with a dependable free API; so instead of shipping
-- numbers we cannot verify, the app records what the supply actually was,
-- every day, and lets the growth chart build itself from observations.
-- Same honesty rule as the report archive: append-only in practice (the app
-- only ever inserts; a day's row is written once).

CREATE TABLE IF NOT EXISTS supply_snapshots (
  snapshot_date      date PRIMARY KEY,
  circulating_supply numeric,
  total_supply       numeric,
  max_supply         numeric,
  market_cap_usd     numeric,
  volume_24h_usd     numeric,
  source             text NOT NULL DEFAULT 'coingecko',
  captured_at        timestamptz NOT NULL DEFAULT now()
);
