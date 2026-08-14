# Phase 0 Report — Product decisions & Pi platform validation

## What was done

- Signal-sourcing decision documented in `SIGNAL_SOURCING.md`: manual operator
  publication for v1, engine-ingestion contract identical, both §11 safe patterns
  (delayed publish via `visible_from`, separate public-safe engine) supported in code.
- Data-source decision documented in `DATA_SOURCES.md`: OKX primary (WS+REST),
  MEXC secondary (REST failover), Bitget tertiary cross-check; rate limits reviewed;
  PIUSDT-not-on-Binance reality (brief §2.5) reflected.
- Monetization decision documented in `MONETIZATION.md`: free at launch,
  freemium-ready behind `MONETIZATION_MODE`, with the §3.8 honesty floor hard-coded.
- Legal disclaimer templating done: risk/terms/privacy drafted as in-app pages
  (`/legal/*`), advice-language rules encoded as a failing test (`test/language.test.ts`).
- Pi platform mechanics documented in `PI_PLATFORM.md` from the official developer
  documentation: SDK init, auth verification via `/v2/me`, payment
  approve/complete server flow, sandbox mode, submission requirements.

## Numbers / verification

- 4 decision docs committed. Advice-language scan covers 25+ user-facing source files.

## What surprised me

- MEXC's v3 websocket moved to protobuf — REST polling chosen for the secondary
  (documented deviation from the brief's "WebSocket clients" default, with rationale).
- Pi platform has no third-party push-notification API, which collides with brief
  §Phase 4.3; the privacy non-negotiable (§3.10, no emails) wins — no push in v1.

## Known limitations / open questions

- **Operator-blocked items** (cannot be done by the coding agent, listed in
  `PI_PLATFORM.md`): Pi Developer account creation, sandbox API key, app registration.
- Prior-art scan of the Pi App Directory (§Phase 0.6) requires browsing the directory
  inside Pi Browser — deferred to the operator with the account task.
- All three decision docs are **defaults pending operator approval**, flagged as such.

## Recommendation

Proceed to Phase 1 (done in this same build session). Operator: work the checklist at
the bottom of `PI_PLATFORM.md`, confirm or amend the three decision docs.
