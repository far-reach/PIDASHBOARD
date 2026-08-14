# SIGNAL_SOURCING — Phase 0 decision (brief §Phase 0.1)

**Status: default adopted for the build; operator confirmation required before launch.**

## Decision (v1 default)

**Manual operator publication**, through the auth-gated `/admin` console or the equivalent
`POST /api/signals` endpoint (Bearer `ADMIN_API_KEY`). The payload matches the brief:
`{symbol, direction, entry, stop, target, rationale, issued_at, expires_at}` plus two
additions: `visible_from` (delayed publish) and `is_test`.

The ingestion endpoint is the same endpoint — if the operator later wires an external
signal engine, it POSTs with `source: "engine"` and nothing else changes. Both paths write
the identical immutable record.

## Why not relay the private system directly

The operator runs a private signals system (bluechipsignal). Brief §11 is explicit:
piping it straight to a public app degrades the private edge (front-running, market
absorption) and couples the public track record to a system tuned for private execution.

Two safe patterns are supported **in code today**:

1. **Delayed publish** — set `visible_from` when publishing. The signal exists and is
   immutable from the moment of issue (provable timestamps), but non-admin users see it
   only after the delay; the entry is stale by the time it is public. Closed signals are
   always visible regardless, so the record stays complete.
2. **Separate public-safe engine** — publish from a distinct model (higher-timeframe,
   less crowded setups) via `source: "engine"`. The private system stays private.

## Operator decisions still open

- [ ] Confirm manual publication for launch, or specify the engine interface
      (API push as above? file drop? DB read?) — the endpoint contract is ready either way.
- [ ] If any relay from the private system is ever wanted: choose pattern 1 or 2 above.
      Direct piping without one of them is out, per brief §11.
- [ ] Default `visible_from` delay for live signals (suggestion: 15–30 minutes, or
      "publish after entry is filled/invalidated").
