-- Hardening pass (pre-publication review).

-- 1. Payment replay protection: one subscription per Pi payment, ever.
--    Without this, calling /complete twice with the same payment id stacks
--    additional 30-day periods onto the same purchase.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_payment_uniq
  ON subscriptions (payment_id)
  WHERE payment_id IS NOT NULL;

-- 2. The append-only triggers on signals / signal_events are row-level, so
--    they never fire for TRUNCATE — which would erase the entire published
--    record without raising. Statement-level triggers close that hole.
DROP TRIGGER IF EXISTS signals_no_truncate ON signals;
CREATE TRIGGER signals_no_truncate
  BEFORE TRUNCATE ON signals
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

DROP TRIGGER IF EXISTS signal_events_no_truncate ON signal_events;
CREATE TRIGGER signal_events_no_truncate
  BEFORE TRUNCATE ON signal_events
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- 3. Fill tracking. A signal that never traded at its entry level must not be
--    scored as a win or a loss: booking a target that the market reached
--    without ever filling the entry silently inflates the record. 'filled' is
--    a non-terminal event appended by the resolver when price touches entry;
--    only a filled signal can subsequently hit its target or stop.
ALTER TABLE signal_events DROP CONSTRAINT IF EXISTS signal_events_type_check;
ALTER TABLE signal_events ADD CONSTRAINT signal_events_type_check
  CHECK (type IN ('published', 'filled', 'hit_tp', 'hit_sl', 'expired', 'manual_close'));

-- At most one fill per signal.
CREATE UNIQUE INDEX IF NOT EXISTS signal_events_filled_uniq
  ON signal_events (signal_id)
  WHERE type = 'filled';
