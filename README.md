# PiPulse — PIUSDT Dashboard for the Pi Network ecosystem

A mobile-first web app, built to ship in the **Pi Network App Directory**, that gives Pioneers
an honest view of the PIUSDT market:

- **Live price** aggregated from OKX (primary) + MEXC (secondary) with automatic failover,
  freshness badges, and a cross-exchange divergence flag (Bitget as tertiary cross-check)
- **Candlestick chart** (1m / 5m / 1h / 1d) with volume
- **Automated daily reports** — OHLC, notable hourly moves, key levels, volume anomalies,
  funding context; generated idempotently once per UTC day, archived for 30 days
- **Trading-signals feed** with an **immutable, append-only history**: entries, stops,
  targets and outcomes can never be edited or deleted — enforced by database triggers,
  not just missing API endpoints
- **Honest performance page** — win rate, average R, max drawdown, streaks, full-history
  equity curve and R distribution, all derived live from the event log with no override
- **Pi SDK integration** — Pi identity sign-in, Pi payment flow for an optional Pro tier,
  graceful fallback in normal browsers (the free tier works everywhere)
- **PWA** — installable, offline-tolerant (last-known data shown with an explicit badge)

> **Not financial advice.** Every screen carries disclaimers; the app never executes
> trades, never holds funds, and never asks for exchange or wallet keys.

Built against the specification in `CLAUDE_CODER_BRIEF.md` (see repo history) with its
non-negotiables — signal immutability, loss transparency, no-custody, disclaimer coverage,
data-source failover — implemented and covered by tests.

---

## Quick start (local)

```bash
npm install
cp .env.example .env    # defaults work out of the box
npm run dev             # http://localhost:3000
```

No database setup needed for development: without `DATABASE_URL` the app runs on an
embedded [PGlite](https://pglite.dev) (real Postgres compiled to WASM) stored in `.data/`.
Point `DATABASE_URL` at a managed Postgres (Neon / Supabase / Railway) for production —
the SQL, migrations, and triggers are identical.

Seed demo data (marked `is_test`, hidden from public queries):

```bash
npm run db:seed
```

### All commands

| Command | What |
| --- | --- |
| `npm run dev` | Dev server on `localhost:3000` |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest unit suite (60 tests) |
| `npm run test:e2e` | Playwright E2E at Pi Browser's mobile viewport (15 tests) |
| `npm run lint` / `npm run typecheck` | ESLint / strict TypeScript |
| `npm run db:migrate` | Apply `db/migrations/*.sql` |
| `npm run db:seed` | Seed deterministic test signals |
| `npm run worker:ingest` | Always-on collector: OKX websocket + REST polling → snapshots, feed state, signal resolution |
| `npm run worker:report` | Generate yesterday's daily report (idempotent); `--date=YYYY-MM-DD` for a specific day |
| `npm run worker:report:loop` | Long-running scheduler firing at `REPORT_HOUR_UTC`:05 |
| `npm run worker:resolve` | Standalone signal resolver (for serverless-web deployments) |

---

## Architecture

```
┌────────────────────────┐     ┌──────────────────────────────┐
│ Next.js 15 (App Router)│     │ workers/ (always-on Node)    │
│  UI pages + API routes │     │  ingest: WS+REST → snapshots │
│  Vercel / Railway      │     │  report: daily @ 00:05 UTC   │
└───────────┬────────────┘     │  resolve: price → events     │
            │                  └──────────────┬───────────────┘
            │      ┌─────────────────────┐    │
            ├──────│ PostgreSQL          │────┤   signals + signal_events are
            │      │ (or PGlite in dev)  │    │   APPEND-ONLY (DB triggers)
            │      └─────────────────────┘    │
            │      ┌─────────────────────┐    │
            └──────│ Redis (optional)    │────┘
                   └─────────────────────┘
   Exchange sources: OKX (primary, WS+REST) → MEXC (failover, REST)
                     Bitget (cross-check only, divergence flag)
```

Key invariants, and where they are enforced:

| Invariant (brief §3) | Enforcement |
| --- | --- |
| Signal history immutable | `BEFORE UPDATE OR DELETE` triggers on `signals` + `signal_events`; no PATCH/PUT/DELETE endpoints (they return 405); repo layer contains no UPDATE/DELETE; tested |
| One terminal event per signal | Partial unique index — resolver races cannot double-close |
| Performance derived, never stored | `/api/performance` recomputes from events on every request |
| Losses shown equal to wins | Same card component, same size/styling; CVD-validated color pair always paired with text labels; E2E-asserted |
| Disclaimers everywhere | Layout-level footer + risk banner; E2E asserts every page |
| Failover with badges | Aggregator promotes MEXC when OKX fails, flags `is_failover` + staleness `> 60s`; unit-tested |
| Payments verified server-side | Entitlements only after Pi platform confirms `/complete`; client "paid" claims are never trusted |
| No data beyond Pi SDK | Schema stores `pi_user_id` + username only; no analytics, no email |

## Configuration

See [`.env.example`](.env.example) for every variable. The important ones:

- `DATABASE_URL` — Postgres in production (unset = embedded PGlite for dev)
- `ADMIN_API_KEY` — operator bearer key for publishing signals (`/admin` UI + `POST /api/signals`)
- `PI_API_KEY` — server key from the [Pi Developer Portal](https://minepi.com/developers/)
- `NEXT_PUBLIC_PI_SANDBOX` — `true` until App Directory launch
- `MONETIZATION_MODE` — `free` (default) or `freemium` (gates *current open signals only*;
  closed history and performance stay public — see `MONETIZATION.md`)

## Deployment runbook

1. **Web app** → Vercel or Railway. Set env vars; run `npm run db:migrate` against the
   production `DATABASE_URL` (as a build/release step or one-off).
2. **Worker** → Railway / Fly.io always-on service: `npm run worker:ingest`
   (it also resolves signals). Add `npm run worker:report:loop` as a second process, or
   schedule `npm run worker:report` via cron at 00:05 UTC.
3. **Monitoring** → point an uptime monitor at `/api/health` (reports `ok | degraded | down`
   per subsystem); add Sentry via `@sentry/nextjs` wizard when a DSN exists.
4. **Pi Portal** → register the app, complete domain validation, set the app URL, obtain
   `PI_API_KEY`; test auth + payment end-to-end in the Pi sandbox. See `PI_PLATFORM.md`.
5. **Before submission** → work through `PHASE_5_REPORT.md`'s blocked checklist
   (7-day ingestion soak, real-device Pi Browser pass, legal review, operator sign-off).

## Operating rules (non-negotiable)

- A published signal is **permanent**. Close it early with a reason if needed — the loss
  books; the record survives. There is no edit and no delete, deliberately.
- Keep `is_test = true` on everything until launch; test data is invisible to the public
  and excluded from public performance.
- Never introduce "guaranteed", "risk-free", "you should buy" language — the unit suite
  scans user-facing sources and fails on it.
- Free tier always keeps: full closed-signal history, full performance, all disclaimers.

## Project documents

| Doc | Content |
| --- | --- |
| `SIGNAL_SOURCING.md` | Where trading calls come from (Phase 0 decision) |
| `DATA_SOURCES.md` | Exchange selection, rate limits, websocket status (Phase 0 decision) |
| `MONETIZATION.md` | Free vs freemium policy and what may never be gated (Phase 0 decision) |
| `PI_PLATFORM.md` | Pi SDK/platform integration notes + submission checklist |
| `PHASE_0_REPORT.md` … `PHASE_5_REPORT.md` | Phase-exit reports with verification status |
| `SESSION_NOTES.md` | Running log for the next working session |

## License

MIT — see [LICENSE](LICENSE).
