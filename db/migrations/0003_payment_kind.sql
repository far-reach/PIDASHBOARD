-- ── Payment kind ───────────────────────────────────────────────────────────
--
-- Payments used to be exclusively subscription purchases. Voluntary tips are a
-- second kind: same verified approve/complete flow, but they grant no
-- entitlement. Recording which is which keeps the ledger honest for accounting
-- and makes "did this payment buy anything?" answerable from the row alone,
-- rather than by re-parsing the raw platform payload.
--
-- Existing rows predate tips, so 'pro' is the correct backfill.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'pro';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_kind_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_kind_check CHECK (kind IN ('pro', 'tip'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS payments_kind_status_idx ON payments (kind, status);
