# Phase 3 Report — Signals feed + performance tracker (trust-critical)

## What was done

- `POST /api/signals` (operator-key auth): writes an immutable signal + `published`
  event; zod validation enforces coherent levels (long: stop < entry < target; short
  mirrored), future expiry, mandatory rationale.
- Immutability enforced in **three layers**: DB `BEFORE UPDATE OR DELETE` triggers on
  both tables; no PATCH/PUT/DELETE handlers (explicit 405s with an explanation);
  repo layer contains zero UPDATE/DELETE statements (asserted by test).
- Event resolver (`src/lib/signals/resolver.ts` + workers): watches live price, appends
  `hit_tp` / `hit_sl` / `expired` with the triggering price + source + timestamp;
  stop-before-target on ambiguous ticks (losses book first); partial unique index makes
  double-closing impossible under any race.
- Performance computer (`src/lib/signals/performance.ts`): win rate, avg/sum/best/worst
  R, max drawdown, streak, full equity curve, monthly breakdown, symmetric R histogram —
  derived on every request, no stored aggregates, no override path.
- Feed UI: newest-first cards with status, rationale, entry/stop/target, unrealized R
  for open and realized R for closed; **identical layout for winners and losers**.
- Performance page: full-history baseline equity chart (drawdown visually unavoidable),
  monthly table, R distribution.
- Admin console `/admin`: publish form (with delayed-visibility field), open-signal
  list, manual-close-with-mandatory-reason. No edit. No delete. TEST-mode checkbox on
  by default.

## Numbers / verification

- **Immutability tested by attempted mutation** (exit criterion): real
  `UPDATE`/`DELETE` SQL rejected by triggers; API PATCH/PUT/DELETE return 405;
  second terminal event rejected. `test/immutability.test.ts`, 9 assertions.
- **Performance vs hand-computed** (exit criterion): 22-signal fixture (12W/10L) —
  win rate 54.55%, ΣR 9.3, max drawdown 2.0R, streak +2, monthly partition 8/8/6,
  every value hand-derived in comments. `test/performance.test.ts`, 12 tests.
- **Losing ≡ winning presentation** (exit criterion): E2E asserts equal card width and
  identical class lists across win/loss cards.
- **E2E lifecycle** (exit criterion): publish → feed → 405 on mutation → 401 unauth →
  422 close-without-reason → close books +1R → performance updates → double-close 409.
- 60 unit + 15 E2E tests green.

## What surprised me

- Nothing structural; the histogram JSON bug (see PHASE_2_REPORT) was found here-adjacent
  and fixed with a serialization regression test.

## Known limitations / open questions

- Resolution granularity = ingest tick interval (5s default; WS ticks when live). An
  intra-tick wick that touches a level between polls resolves on the next tick's price —
  actual fill prices are recorded, so the record stays honest, but fast wicks can differ
  from exchange-candle extremes. Documented; acceptable for v1.
- The ≥ 20-signal performance exit criterion is met with the deterministic seed +
  fixtures; live-data confirmation accrues after deployment.

## Recommendation

Proceed to Phase 4 (done).
