# MONETIZATION — Phase 0 decision (brief §Phase 0.3)

**Status: default adopted for the build; operator confirmation required before launch.**

## Decision (v1 default): launch FREE, freemium-ready

`MONETIZATION_MODE=free` at launch. The entire app — price, chart, reports, the full
signals feed, performance — is free while the record builds. Brief §8 warns against
launching with an empty history; a paid tier over an empty track record is worse.

The freemium machinery is **built and tested**, enabled by flipping
`MONETIZATION_MODE=freemium`:

| | Free tier (always) | Pro tier (Pi payment, 30 days) |
| --- | --- | --- |
| Live price, chart, market stats | ✅ | ✅ |
| Daily reports + 30-day archive | ✅ | ✅ |
| **Closed** signals, full history | ✅ | ✅ |
| **Performance page, complete** | ✅ | ✅ |
| Disclaimers, education | ✅ | ✅ |
| **Currently-open signals** | ❌ (count shown, contents gated) | ✅ |
| In-app alerts (when shipped) | ❌ | ✅ |

This is exactly the split brief §3.8 permits: paid may gate *real-time* value
(open calls, alerts); honesty — history, performance, disclaimers — is never gated.
The feed meta always reports `hidden_open_count`, so free users see **that** open signals
exist, only not their levels (avoids the §8 "we're up 300%, trust us" rugpull pattern).

## Tips — direct support, always available

Separate from the subscription, and live in `free` mode too: a **Support PiPulse** card on
the home screen lets a signed-in Pioneer send Pi straight to the app wallet. Quick-pick
amounts come from `NEXT_PUBLIC_TIP_PRESETS`; any amount between `MIN_TIP_PI` and
`MAX_TIP_PI` is accepted.

A tip **grants nothing** — no signals, no access, no entitlement — and the UI says so. That
is what keeps it compatible with the §3.8 honesty rules and with launching free: there is
no version of the app where paying reveals a better record.

The two products are distinguished by the payment metadata *as the Pi platform reports it*
(`pipulse-pro-30d` vs `pipulse-tip`), never by what the browser claims:

| | Subscription | Tip |
| --- | --- | --- |
| Amount rule | must be ≥ `PRO_PRICE_PI` | any amount in `[MIN_TIP_PI, MAX_TIP_PI]` |
| Grants | 30 days of Pro | nothing |
| Available in `free` mode | ❌ | ✅ |
| Ledger `payments.kind` | `pro` | `tip` |

An unrecognised product is rejected (422) rather than defaulted, so a tip can never be
routed through the subscription path or vice versa.

## Payment mechanics (implemented)

- Pi payment via official SDK `createPayment` → server `approve` → server `complete`
  against the Pi Platform API (`Authorization: Key PI_API_KEY`).
- Entitlement (30-day `subscriptions` row) is written **only after the Pi platform
  confirms the completed transaction**; the client is never trusted (brief §Phase 4.5).
- Renewal stacks onto the current expiry, so early renewal never loses days.
- Every gated read re-checks the subscription server-side; nothing is client-gated.

## Operator decisions still open

- [ ] Confirm free-at-launch, and the criterion for flipping to freemium
      (suggestion: ≥ 1 full month of public daily reports + signal history, per brief §8)
- [ ] Pro price in Pi (the amount is a UI/env value; suggest testing sandbox with 1 π)
- [ ] Tip presets and bounds (defaults: 1 / 5 / 10 π quick-picks, 0.1 – 1000 π accepted)
- [ ] Whether expired/manual-close open-signal *notifications* land in Pro or free
