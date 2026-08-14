-- PiPulse initial schema.
--
-- Design constraint (CLAUDE_CODER_BRIEF §3.1-3.2): the signal history is an
-- append-only event log. Immutability is enforced HERE, at the database,
-- not merely by the absence of API endpoints: BEFORE UPDATE/DELETE triggers
-- reject any mutation of `signals` and `signal_events`.

CREATE TABLE IF NOT EXISTS signals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol       text NOT NULL,
  direction    text NOT NULL CHECK (direction IN ('long', 'short')),
  entry        numeric NOT NULL CHECK (entry > 0),
  stop         numeric NOT NULL CHECK (stop > 0),
  target       numeric NOT NULL CHECK (target > 0),
  rationale    text NOT NULL DEFAULT '',
  issued_at    timestamptz NOT NULL,
  expires_at   timestamptz,
  -- Delayed-publish support (brief §11 pattern 1): the signal exists and is
  -- immutable from creation, but is not shown to non-admin users until this
  -- time. NULL = visible immediately.
  visible_from timestamptz,
  source       text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'engine', 'seed')),
  is_test      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- A long must risk down and reward up; a short the reverse.
  CHECK (
    (direction = 'long'  AND stop < entry AND target > entry) OR
    (direction = 'short' AND stop > entry AND target < entry)
  )
);

CREATE INDEX IF NOT EXISTS signals_symbol_issued_idx ON signals (symbol, issued_at DESC);

CREATE TABLE IF NOT EXISTS signal_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id    uuid NOT NULL REFERENCES signals(id),
  type         text NOT NULL CHECK (type IN ('published', 'hit_tp', 'hit_sl', 'expired', 'manual_close')),
  -- The market data snapshot that triggered the event (brief §3.1).
  price        numeric,
  price_source text,
  note         text NOT NULL DEFAULT '',
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signal_events_signal_idx ON signal_events (signal_id, occurred_at);

-- Exactly one terminal event per signal, enforced by the database so a
-- resolver race can never double-close a signal.
CREATE UNIQUE INDEX IF NOT EXISTS signal_events_terminal_uniq
  ON signal_events (signal_id)
  WHERE type IN ('hit_tp', 'hit_sl', 'expired', 'manual_close');

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: % on % is forbidden', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS signals_immutable ON signals;
CREATE TRIGGER signals_immutable
  BEFORE UPDATE OR DELETE ON signals
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DROP TRIGGER IF EXISTS signal_events_immutable ON signal_events;
CREATE TRIGGER signal_events_immutable
  BEFORE UPDATE OR DELETE ON signal_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ── Market data ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS price_snapshots (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  symbol      text NOT NULL,
  price       numeric NOT NULL,
  bid         numeric,
  ask         numeric,
  volume_24h  numeric,
  source      text NOT NULL,
  is_failover boolean NOT NULL DEFAULT false,
  ts          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_snapshots_symbol_ts_idx ON price_snapshots (symbol, ts DESC);

CREATE TABLE IF NOT EXISTS daily_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol       text NOT NULL,
  report_date  date NOT NULL,
  open         numeric,
  high         numeric,
  low          numeric,
  close        numeric,
  change_pct   numeric,
  volume       numeric,
  content_md   text NOT NULL,
  data         jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  -- Idempotency (brief §Phase 1.5): one report per (symbol, date); re-runs
  -- are ON CONFLICT DO NOTHING no-ops.
  UNIQUE (symbol, report_date)
);

-- ── Users / monetization (Pi SDK identity only — brief §3.10) ─────────────

CREATE TABLE IF NOT EXISTS users (
  pi_user_id   text PRIMARY KEY,
  username     text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  prefs        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pi_user_id  text NOT NULL REFERENCES users(pi_user_id),
  plan        text NOT NULL DEFAULT 'pro',
  status      text NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  payment_id  text
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions (pi_user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  payment_id text PRIMARY KEY,
  pi_user_id text,
  amount     numeric,
  memo       text,
  status     text NOT NULL DEFAULT 'created'
             CHECK (status IN ('created', 'approved', 'completed', 'cancelled', 'failed')),
  txid       text,
  raw        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Cross-process state (worker → web) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS kv (
  k          text PRIMARY KEY,
  v          jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
