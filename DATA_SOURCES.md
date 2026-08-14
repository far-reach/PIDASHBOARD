# DATA_SOURCES — Phase 0 decision (brief §Phase 0.2)

**Status: default adopted for the build; operator confirmation required before launch.**

## Selected sources (v1)

| Role | Venue | Instrument | Transport | Notes |
| --- | --- | --- | --- | --- |
| **Primary** | OKX | `PI-USDT` spot; `PI-USDT-SWAP` for funding context | Public websocket (`tickers` channel) + REST safety net | Deep PI liquidity, clean JSON WS protocol, public market data needs no API key |
| **Secondary (failover)** | MEXC | `PIUSDT` spot | REST polling at the ingest interval | One of the earliest/most liquid PI listings |
| **Tertiary (cross-check only)** | Bitget | `PIUSDT` spot | REST | Never served to users; feeds the >1% divergence honesty flag |

PIUSDT is **not** listed on Binance (brief §2.5); the aggregation set above matches where
the pair actually trades. CoinGecko/CMC were considered for cross-check but a third
exchange gives an order-book-backed price rather than an index.

## Failover behavior (implemented + unit-tested)

- Priority order OKX → MEXC. A source is served only if its websocket tick is fresh
  (< 15s) or its REST call succeeds; otherwise the next source is promoted and the
  response is flagged `is_failover: true` → UI badge.
- Recovery is automatic: the primary is retried on every cycle and reclaims the feed the
  moment it answers.
- All sources down → API returns 503 and the UI says so; the PWA falls back to last-known
  data labeled "offline · last known".
- Staleness: anything older than 60s is flagged `STALE` (brief §3.7).

## Rate limits & terms (as of build date — re-verify at deploy)

- **OKX** public market data: per-endpoint public rate limits (ticker ~20 req/2s per IP)
  — our single-worker polling at 5s intervals plus one WS connection is far inside them.
- **MEXC** spot v3: weight-based public limits comparable to Binance's model; one poll
  per 5s is negligible.
- **Bitget** v2 public: 20 req/s per IP class — one cross-check per cycle is negligible.
- All three publish public market data without authentication; redistribution for display
  with venue attribution (shown in the source badge) is standard practice. Commercial ToS
  review is on the Phase 5 checklist.

## WebSocket status

- OKX WS: implemented (`src/lib/market/okx-ws.ts`) with keepalive ping and exponential
  reconnect; used by the ingest worker.
- MEXC WS: **deliberately not used in v1** — their v3 stream moved to protobuf frames;
  REST polling at the ingest interval is simpler and fully adequate for a failover source.
  Revisit only if sub-second secondary freshness ever matters.

## On-chain Pi data (brief §Phase 0 research)

Pi mainnet is a Stellar-derived chain with public Horizon endpoints; holder/large-transfer
analytics would need either a self-hosted indexer or a third-party explorer API of
uncertain stability. **Deferred past v1** — tracked as a v2 candidate in PHASE_0_REPORT.

## Operator decisions still open

- [ ] Confirm OKX/MEXC/Bitget selection (or reorder venues)
- [ ] Commercial-use ToS re-check at deployment time (Phase 5 checklist item)
