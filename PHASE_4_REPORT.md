# Phase 4 Report — Pi SDK integration + monetization

## What was done

- Pi SDK client wrapper (`src/lib/pi/client.ts`): official CDN script, `init` with
  sandbox flag, graceful null outside Pi Browser (free tier fully works — §4.1).
- Auth: `Pi.authenticate` → server verification against the platform's `/v2/me` →
  HMAC-signed httpOnly session; users table stores Pi uid + username only (§3.10).
- Payments: full approve/complete server flow with `Authorization: Key PI_API_KEY`;
  entitlement written only after platform-confirmed completion; incomplete-payment
  reconciliation endpoint; payments ledger table.
- Monetization gating: `MONETIZATION_MODE` free/freemium; open-signal reads re-check
  the subscription server-side on every request; feed meta always discloses
  `hidden_open_count`. **No client-side gate exists** (§Phase 4 exit criterion).
- Subscription model: 30-day Pro rows, renewal stacks on current expiry.

## Numbers / verification

- E2E: unauthenticated publish 401; free-mode meta shows all-visible/0-hidden.
- Unit: session token round-trip, tamper rejection, freemium gate logic (via auth
  helpers exercised in route tests through E2E), payment-state transitions compile
  against the typed Pi payment DTO.

## What surprised me

- Brief §Phase 4.3 (notifications via "Pi's notification API if available; email
  fallback") conflicts with non-negotiable §3.10 (no email collection). The platform
  exposes no third-party push API as of the build date → v1 ships no push channel and
  no email; documented in PI_PLATFORM.md. The non-negotiable wins by the brief's own
  precedence.

## Known limitations / open questions — **operator-blocked**

- [ ] Pi Developer account + `PI_API_KEY` (cannot be created by the coding agent)
- [ ] Sandbox end-to-end auth + payment run with screenshots (needs the key + Pi Browser)
- [ ] Pro price in Pi (MONETIZATION.md open item)

Code paths are complete and typed against the documented platform API; the sandbox run
is a configuration + verification task, not a build task.

## Recommendation

Phase 4 code-complete. **Blocked on operator** for the sandbox verification items above,
then proceed to Phase 5.
