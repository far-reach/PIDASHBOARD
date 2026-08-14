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
- [ ] Whether expired/manual-close open-signal *notifications* land in Pro or free
