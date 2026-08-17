# PI_PLATFORM — integration notes & submission checklist (brief §Phase 0.4, §Phase 4-5)

## How the integration works (implemented)

### SDK (client)

- Loaded from the official URL `https://sdk.minepi.com/pi-sdk.js` at runtime
  (`src/lib/pi/client.ts`), then `Pi.init({ version: "2.0", sandbox })`.
  `NEXT_PUBLIC_PI_SANDBOX=true` until launch.
- **Outside Pi Browser the loader resolves to null** and the app degrades gracefully:
  browsing, reports, history, performance all work; only sign-in/subscription need
  Pi Browser (brief §Phase 4.1).

### Auth (server-verified)

1. Client: `Pi.authenticate(["username", "payments"], onIncompletePaymentFound)`
2. Client → `POST /api/pi/verify { accessToken }`
3. Server: `GET https://api.minepi.com/v2/me` with the token — the Pi platform, not the
   client, says who the user is.
4. Server issues an HMAC-signed httpOnly session cookie; the user row stores
   `pi_user_id` + username, nothing else.

### Payments (server-approved and server-completed)

1. Client: `Pi.createPayment({ amount, memo, metadata }, callbacks)`
2. `onReadyForServerApproval` → `POST /api/pi/payments/approve` →
   server calls `POST /v2/payments/{id}/approve` with `Authorization: Key PI_API_KEY`
3. `onReadyForServerCompletion(txid)` → `POST /api/pi/payments/complete` →
   server calls `/v2/payments/{id}/complete`; only a platform-confirmed completion
   activates the subscription
4. Stuck payments (`onIncompletePaymentFound`) → `POST /api/pi/payments/incomplete` →
   server re-reads the payment from the platform and completes or cancels it.

All Pi Platform API calls live in `src/lib/pi/server.ts`; endpoints follow the official
Platform API. **If the live docs disagree with these paths at deploy time, the docs win**
(brief ground rule) — update `PI_API_BASE`/paths accordingly and re-test in sandbox.

### Notifications

Pi does not expose a general push API to third-party apps (as of the build date), and
email collection is banned by non-negotiable §3.10. v1 therefore has **no push channel**;
"alerts" remain an in-app concept. Revisit when the Pi platform ships app notifications —
noted in PHASE_4_REPORT as the one brief §Phase 4.3 item that is platform-blocked.

## Operator actions (cannot be done by the coding agent)

- [ ] Create the developer account: open `develop.pi` in Pi Browser (or
      minepi.com/developers), register **Cyberekt Market** as an app
- [ ] Complete app checklist: app URL (production deploy), domain validation key,
      description, logo (use `public/icon.svg` as the master; export PNG sizes the portal
      asks for)
- [ ] Obtain `PI_API_KEY` from the portal → set as a server secret
- [ ] Sandbox test: full auth + 1 π payment flow end-to-end in the Pi sandbox
      (screenshots into PHASE_4_REPORT)
- [ ] Naming/trademark check: "Cyberekt Market" and any use of "Pi" must be cleared against the
      Pi Core Team's brand guidelines during review; the app already self-identifies as
      independent/unaffiliated in the footer and legal pages
- [ ] Submission per the current App Directory process (re-read the developer docs at
      submission time — the process changes)

## Submission checklist (Phase 5 gate — do not submit before all check)

- [ ] Phases 0–4 reports closed, operator-approved
- [ ] 7-day continuous ingestion soak passed (health endpoint green, no >5min gaps)
- [ ] ≥ 1 month of daily reports + real signal history visible (brief §8)
- [ ] Real-device Pi Browser pass (mobile) — screenshots archived
- [ ] Legal pages reviewed by counsel; hosted at stable URLs (already routed:
      `/legal/terms`, `/legal/privacy`, `/legal/risk`)
- [ ] Sentry receiving events; uptime monitor on `/api/health`
- [ ] `NEXT_PUBLIC_PI_SANDBOX=false`, production `PI_API_KEY`, strong `ADMIN_API_KEY`
      and `SESSION_SECRET` rotated in
- [ ] Operator sign-off in writing
