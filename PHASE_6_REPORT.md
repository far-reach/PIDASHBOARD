# Phase 6 Report — Pre-publication hardening review

Not in the original brief's phase list. Added because "ready to publish" warrants an
adversarial pass over code that will handle real money and a public track record.

## What was done

A five-dimension review fleet audited the codebase independently (trust invariants,
security, correctness, brief compliance, publish readiness), then each ranked finding was
handed to an adversarial verifier instructed to refute it. 33 raw findings; the real ones
are fixed below, each with a regression test.

### Trust invariants

- **Unfilled signals were scored.** The resolver booked `hit_tp`/`hit_sl` on any signal
  whose target or stop the market touched, *even if the entry price never traded*. A call
  published on the far side of the market would book an instant, arbitrarily large win for
  a trade nobody could have taken. Added a `filled` event to the lifecycle: a signal must
  fill (market trades at or through entry) before it can hit anything, and an unfilled
  signal that expires is recorded but carries `r = null` and never enters performance.
  Shown in the UI as `NOT FILLED · UNSCORED`.
- **Manual close accepted any price.** The operator could name the exit price, which is a
  direct dial on the win rate. Now the price comes from the live market; an operator-supplied
  price is accepted only within 2% of it. If the feed is down the close is still allowed —
  refusing would strand the operator during exactly the conditions that matter — but the
  event permanently records `operator-supplied (UNVERIFIED — no market feed at close time)`.
- **Backdating was undetectable.** `issued_at` was unbounded. Now limited to 10 minutes in
  the past, and the row's true `created_at` is exposed in the API so any gap is visible.
- **Truncation made the pages disagree.** The feed capped at 200 and performance at 500
  signals while claiming "full history". Performance now reads the complete record.
- **`TRUNCATE` bypassed the append-only triggers** (they were row-level only). Added
  statement-level triggers; tested.
- **The histogram could paint a catastrophic loss as the best outcome**: an R below the
  lowest bin edge fell through to the top "≥ 3R" bin. Now falls back by sign.

### Security / payments

- **The payment amount was never verified** — any non-zero payment granted 30 days of Pro.
  Both legs now check the amount against `PRO_PRICE_PI` before approving or entitling.
- **Payment replay** could stack subscription periods. Activation is idempotent per payment
  id, backed by a unique index so concurrent duplicates lose too.
- **`SESSION_SECRET` fell back to a hardcoded literal**, publicly readable in this repo —
  forgeable sessions on any deployment that forgot the variable. Production now refuses to start.
- **The incomplete-payment endpoint was unauthenticated** and wrote the ledger for arbitrary
  payment ids. Now requires a session and payment ownership.
- **The rate limiter keyed on client-controlled `x-forwarded-for`** (mint unlimited
  identities) and cleared every bucket on overflow (reset everyone's limits). Now prefers
  platform-set headers, uses the rightmost XFF entry, and evicts only refilled buckets.
- `/api/health` no longer returns raw internal error strings in production.

### Correctness

- **A zero/NaN price from an exchange would have stopped out every open long at price 0.**
  `Number("")` is `0`, and venues return `"0"`/`""` for halted instruments. All clients now
  validate before a tick leaves them, which also makes the aggregator fail over correctly.
- **The cross-venue divergence check never ran**: the secondary was only fetched while the
  primary was down, so `divergencePct()` was structurally always null. Non-serving venues
  are now refreshed on an interval.
- **The offline badge disappeared after the first successful load.** React Query keeps the
  last good `data` when a refetch fails, so the old test (`!query.data`) hid the badge
  exactly when the feed died — users would stare at a frozen price believing it live.
- **`report_date` shifted a day** on any server east of UTC (node-postgres parses `date` to
  local midnight). Now read via local calendar fields.
- **An empty report could become permanent**: idempotency meant a report generated outside
  the candle window was persisted blank forever. Generation now refuses to persist a
  contentless report, and both the worker and the cron endpoint backfill recent days.
- **The ingest worker's `setInterval` could overlap**, piling unbounded concurrent work onto
  an already-stalling dependency. Cycles are now guarded.
- **`getDb()` memoized a rejected promise** — one transient database blip bricked the
  process until redeploy. The slot is cleared on failure.
- The daily report printed base-asset (PI) volume with a `$` prefix.

### Publish readiness

- **The production build was broken** by an optional `import("@sentry/nextjs")`: webpack
  resolves that specifier statically regardless of the TypeScript cast, so `npm run build`
  failed on any deployment without the package. Replaced with a runtime-attached reporter.
- **Freemium had no way to pay** — `subscribeWithPi` existed but no UI called it. Added the
  upgrade surface, worded so it never implies the track record is what's behind the paywall.
- Funding rate now appears on a live surface (`/api/funding` + stats grid), not only inside
  report prose.
- Reports screen carries an "as of" timestamp.
- `PRO_PRICE_PI` and every other variable read anywhere in the code are documented in
  `.env.example`.

## Numbers / verification

- 90 unit tests (was 60) + 15 E2E, all green; typecheck and lint clean; production build
  succeeds. New suites: `test/hardening.test.ts` (17), `test/deployment.test.ts` (9).
- The E2E lifecycle test now asserts the anti-inflation invariant end to end: a manually
  closed, never-filled signal appears in the record, is labelled `NOT FILLED`, and
  contributes `scored: 0` to performance.

## What surprised me

- Two independent reviewers, given different dimensions, converged on the fill defect from
  opposite directions (one as a trust bug, one as a compliance gap). It was the single most
  valuable finding and it was invisible from the tests that existed.
- The verifier fleet ran while fixes were landing, so some verdicts describe the repaired
  code as grounds for "refuting" the finding. Those were treated as confirmations, not
  dismissals — the git history shows the defect and the fix.

## Known limitations / open questions

- Fill detection uses discrete ticks, so a wick that touches entry between polls is missed
  until the next tick. Recorded prices are always real observed prices, so the record stays
  honest, but the always-on worker (not the 5-minute cron path) is the deployment that
  minimises this.
- Orderbook depth (brief §1) is still not implemented; only top-of-book bid/ask is shown.
- No push notifications: the Pi platform exposes no third-party push API and §3.10 forbids
  collecting emails.

## Recommendation

Proceed to the Phase 5 operator checklist. No known defect blocks deployment.
