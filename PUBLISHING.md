# Publishing PiPulse to the Pi App Directory — step by step

Every step is ordered; each one has a check you can run before moving on. Steps marked
**[you]** need a human (a Pi account, a card, a legal review); the rest are commands.

Sources for the Pi-specific mechanics are listed at the bottom — **re-read them at
submission time**, because Pi changes this process periodically. Where this guide and the
current official docs disagree, the docs win.

---

## Stage 0 — Prerequisites **[you]**

1. A Pi Network account that has **completed KYC** and has **Mainnet migration** done.
   Developer features and payments depend on it. Do this first; KYC can take time.
2. **Pi Browser** installed on your phone (iOS/Android). Nearly all portal work happens
   inside Pi Browser — a desktop browser cannot open `pi://` URLs.
3. A GitHub account with this repo (already at `far-reach/PIDASHBOARD`).
4. Accounts for hosting: **Vercel** (or Railway) and a **Postgres** provider
   (Neon has a usable free tier). Railway/Fly if you want the always-on worker.

**You do NOT need to buy a website.** Vercel issues a free `*.vercel.app` HTTPS URL, and
because this app serves `/validation-key.txt` at its root, that URL passes the Pi
Developer Portal's domain verification exactly like a purchased domain would.

### Where a `.pi` domain fits (read this if you have one)

A `.pi` name such as `cybrekt.pi` is a **PiNet address, not hosting**. It does not run
your code and it cannot serve files by itself — it is the address Pioneers type inside Pi
Browser, which resolves to an app hosted on ordinary HTTPS infrastructure. So the order is:

1. Host the app somewhere real (stage 3) → you get an HTTPS URL.
2. Register that URL as the app's **App URL** and verify ownership (stages 5-6).
3. Register your **PiNet URL** in the portal's *PiNet Settings* (stage 7b) — this is what
   makes the app reachable at a Pi-native address inside Pi Browser.

Note that a newly registered PiNet URL includes a random string of characters; that is a
deliberate anti-squatting measure. Plain, unsuffixed PiNet URLs are granted by the Pi Core
Team at their discretion to well-performing apps. Separately, `.pi` domains are reserved
(and excluded from auction) for apps that have completed PiNet migration and meet the
Ecosystem listing guidelines — which is the same bar stages 11-13 are aimed at.

---

## Stage 1 — Provision the database

1. Create a Postgres database (Neon → new project → copy the **pooled** connection string).
2. Keep it as `DATABASE_URL`; it must include `?sslmode=require` for most providers.

**Check:** `psql "$DATABASE_URL" -c 'select 1'` returns a row. (Skip if you have no psql —
Stage 3's migration will prove it.)

---

## Stage 2 — Generate your secrets

```bash
openssl rand -hex 32   # → ADMIN_API_KEY   (publishes signals — treat as a trading secret)
openssl rand -hex 32   # → SESSION_SECRET  (signs user sessions)
openssl rand -hex 32   # → CRON_SECRET     (only if deploying serverless-only)
```

Store them in your password manager. Never commit them. Rotating `SESSION_SECRET` later
logs everyone out; rotating `ADMIN_API_KEY` is free.

---

## Stage 3 — Deploy the web app

### Option A — Vercel (simplest; uses cron instead of a worker)

1. Vercel → **Add New → Project** → import `far-reach/PIDASHBOARD`.
2. Framework preset: **Next.js** (auto-detected). Leave build settings alone —
   `vercel.json` already sets the build command to run migrations first.
3. Add **Environment Variables** (Production + Preview):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | from Stage 1 |
   | `ADMIN_API_KEY` | from Stage 2 |
   | `SESSION_SECRET` | from Stage 2 |
   | `CRON_SECRET` | from Stage 2 |
   | `MONETIZATION_MODE` | `free` |
   | `NEXT_PUBLIC_PI_SANDBOX` | `true` (for now) |
   | `NEXT_PUBLIC_SYMBOL` | `PIUSDT` |

4. **Deploy.** The build runs `npm run db:migrate` first, creating the schema and the
   append-only triggers.

**Check:** `curl https://<your-app>/api/health` → JSON with `"database": {"status":"ok"}`.
`curl https://<your-app>/api/price/latest` → a live PIUSDT price with a `source` and `ts`.

> Vercel cron on the Hobby plan runs **once per day**, which is enough for the daily
> report but **not** for signal resolution. If you publish live signals on Vercel Hobby,
> also run the worker (Option B) or upgrade the plan — otherwise signals resolve late.

### Option B — Railway (recommended for live signals: real always-on worker)

1. Railway → **New Project → Deploy from GitHub repo** → this repo.
2. Add a **Postgres** plugin (or paste your Neon URL as `DATABASE_URL`).
3. Set the same env vars as above (no `CRON_SECRET` needed).
4. Service 1 — **web**: start command `npm run start`, build `npm run build`.
5. Service 2 — **ingest**: same repo, start command `npm run worker:ingest`.
   This is the always-on collector; it also resolves signals continuously.
6. Service 3 (optional) — **report**: start command `npm run worker:report:loop`.
7. Run migrations once: in the web service shell, `npm run db:migrate`.

**Check:** the ingest service logs show `{"msg":"ingest worker starting"}` then periodic
heartbeats, and `/api/health` shows `"feed": {"status":"ok", ...}` with a small `age`.

---

## Stage 4 — Settle on your app URL

**If you have no domain (the normal case):** you are already done. Vercel gave you
`https://<project>.vercel.app` with a valid certificate. Copy it — that is your App URL for
the rest of this guide. Skip to stage 5.

**Only if you own a regular domain** (a `.com`, not a `.pi`): add it in Vercel/Railway,
complete the DNS records they show, and wait for the certificate to issue.

**Check:** your URL loads the dashboard with a padlock. Pi Browser will not accept an app
URL without valid HTTPS.

---

## Stage 5 — Register the app in the Pi Developer Portal **[you]**

All of this is inside **Pi Browser** on your phone.

1. Open Pi Browser → go to **`develop.pi`** (there is also a "Develop" tile on the home
   screen; on newer builds the portal is at `develop.pinet.com` — either entry point
   lands in the same Developer Portal).
2. Tap **New App**. Fill the three required fields:
   - **App Name:** `PiPulse` — use only letters, numbers and spaces; no special characters.
   - **App Network:** ⚠️ **This cannot be changed after registration, and one app connects
     to exactly one network.** Register a **Testnet** app first for sandbox testing, then a
     separate **Mainnet** app for the real listing. Do not try to reuse one for both.
   - The third field is the short description — see Stage 9 for copy you can paste.
3. Open the app's **App Checklist** from the dashboard; it unlocks steps in order.

---

## Stage 6 — Verify domain ownership

The portal shows a **validation key** in a grey box. It must be served at
`<your app URL>/validation-key.txt` — e.g. `https://pipulse.vercel.app/validation-key.txt`.
A `*.vercel.app` URL verifies exactly like a purchased domain.

This app serves it from an environment variable, so **you do not need to edit code**:

1. Copy the key from the portal.
2. In Vercel/Railway, add env var `PI_VALIDATION_KEY` = that key.
3. Redeploy (Vercel: Deployments → ⋯ → Redeploy; Railway: it redeploys on variable change).

**Check:** `curl <your app URL>/validation-key.txt` prints exactly the key, nothing else.

4. Back in the portal, set the **App URL** to your app URL and press **Verify domain**.
   A green check mark appears next to the URL when it succeeds.

---

## Stage 7 — Wire up the Pi keys

1. In the portal's checklist, complete **hosting** (self-hosted, your URL) and
   **connect an app wallet** (needed to receive payments).
2. Copy the **Server API Key** from the portal.
3. Add to your host's env vars:
   - `PI_API_KEY` = the server API key
   - keep `NEXT_PUBLIC_PI_SANDBOX=true` for now
4. Redeploy.

**Check:** open your app **inside Pi Browser** and tap **Sign in with Pi**. You should get
the Pi consent dialog, then the header shows your username. If it says "Open in Pi Browser",
the SDK didn't load — confirm you're in Pi Browser and the app URL matches the registered one.

Behind that button the server verifies the token against Pi's `/v2/me` — a client cannot
fake a sign-in.

---

## Stage 7b — Register your PiNet URL (this is what makes `.pi` work) **[you]**

Your app is now live on the open web, but Pioneers should reach it at a Pi-native address.

1. In the Developer Portal, open your app's dashboard and go to **PiNet Settings**.
2. Register your **PiNet URL** in the field provided.
3. The app becomes available at the PiNet URL shown on the dashboard.

Two things to expect, so neither is a surprise:

- The URL you get **includes a random string of characters**. That is deliberate —
  it prevents domain squatting and impersonation. It is not a misconfiguration and there
  is no setting to remove it.
- **Plain, unsuffixed PiNet URLs are granted by the Pi Core Team at their discretion** to
  well-performing apps. That is also the route by which a `.pi` domain like `cybrekt.pi`
  becomes the app's public address: `.pi` domains are reserved for apps that have completed
  PiNet migration and meet the Ecosystem listing guidelines.

In other words, `cybrekt.pi` is earned at the end of this process, not configured at the
start. Stages 11-13 — a real track record, then listing — are the path to it.

**Check:** opening the PiNet URL in Pi Browser loads the dashboard, and **Sign in with Pi**
still works from that address.

---

## Stage 8 — Test payments in sandbox **[you]**

Only needed if you plan to charge (`MONETIZATION_MODE=freemium`). Skip while free.

1. With the **Testnet** app and `NEXT_PUBLIC_PI_SANDBOX=true`, sign in, then trigger a
   subscription payment.
2. Watch your server logs: you should see the approve call, then the complete call, and
   only then the subscription becoming active.
3. Verify the entitlement is real: `curl https://yourdomain.com/api/me` with your session
   cookie shows `subscription.active: true`.

**Never** mark anything paid from the client — this app already refuses to
(`/complete` must return 200 from Pi's servers first). Keep it that way.

---

## Stage 9 — Prepare the listing assets

Icons are already generated in `public/`: `icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`, `apple-touch-icon.png`, `icon.svg`. Upload whichever sizes the
portal asks for.

Screenshots: open the app in Pi Browser and capture the Home, Signals, Performance, and
Learn screens on a real phone.

**Short description (paste-ready):**

> Live PIUSDT price from multiple exchanges, an automatic daily market report, and a
> transparent trading-signal record where every call — winning or losing — is permanent.
> Educational information only; not financial advice.

**Long description (paste-ready):**

> PiPulse gives Pioneers a clear, honest view of the PIUSDT market.
>
> • Live price aggregated from OKX and MEXC, with automatic failover and a visible badge
>   whenever data is stale or coming from the backup source.
> • Candlestick charts across 1m / 5m / 1h / 1d with volume.
> • An automatic daily report: the session's open, high, low and close, notable hourly
>   moves, key levels from recent ranges, volume anomalies and funding context.
> • A trading-signals feed where every call is published with its entry, stop-loss, target
>   and reasoning — and can never be edited or deleted afterwards.
> • A performance page computed directly from that permanent record: win rate, average R,
>   maximum drawdown, the full equity curve including the bad stretches, and the complete
>   distribution of results. Losing calls are shown exactly as prominently as winning ones.
> • Educational content explaining how to read the signals, what R multiples mean, and a
>   glossary.
>
> PiPulse never executes trades, never holds your funds, and never asks for exchange or
> wallet keys. It is an independent community app, not affiliated with the Pi Core Team.
> Trading involves risk of loss; nothing in the app is financial advice.

**Category:** Finance (secondary: Education). **Audience:** Pioneers who follow the PI market.

---

## Stage 10 — Go live on Mainnet

1. Register the **Mainnet** app in the portal (Stage 5, choosing Mainnet), verify the
   domain again for it, and get its Mainnet **Server API Key**.
2. Update production env: `PI_API_KEY` = Mainnet key, `NEXT_PUBLIC_PI_SANDBOX=false`.
3. Redeploy, then re-test sign-in in Pi Browser against the live app.

---

## Stage 11 — Build a real track record *before* submitting

This is the step people skip, and it is the one that decides whether the app survives
contact with users. Do not submit an app whose signal history and report archive are empty.

Run publicly for **at least one month**, and during that time:

- Publish signals through `/admin` (uncheck **Test signal** for real ones).
- Confirm the daily report appears each morning and the archive fills up.
- Watch `/api/health` daily; investigate any `degraded`.
- Let the performance page accumulate honestly. **Do not** delete a bad call. If you must
  exit early, use "Close early" and state the reason — that is what the button is for.

**Check before submitting:** `/performance` shows ≥ 20 closed signals, `/reports` has ~30
days of entries, and no feed gap longer than 5 minutes in your logs over a 7-day window.

---

## Stage 12 — Legal review **[you]**

`/legal/terms`, `/legal/privacy`, `/legal/risk` are drafted and live, and every page footer
links to them. Have a qualified lawyer in your jurisdiction review them before submission —
publishing trading signals can be regulated as investment publishing in some places. Update
the pages with whatever counsel says.

---

## Stage 13 — Submit **[you]**

1. Pi Browser → `develop.pi` → your **Mainnet** app → complete every remaining App
   Checklist item (they unlock in order).
2. Submit for **Mainnet ecosystem / App Directory listing**.
3. Meet the ecosystem listing requirements — a working app, accurate description, working
   Pi integration, no misleading claims. Applying does not guarantee listing.
4. Respond to reviewer feedback promptly; fix and redeploy, then reply in the portal.

---

## Stage 14 — After you're listed

- Keep the ingest worker running; a dead feed with a stale price is worse than no app.
- Keep publishing daily. The value here is the unbroken, honest record.
- When you flip to paid: set `MONETIZATION_MODE=freemium` and redeploy. Closed history and
  performance stay free — that is deliberate and must not change.
- Every push to `main` re-runs the full test suite in GitHub Actions. If CI is red, do not
  deploy.

---

## Fast reference

| What | Where |
| --- | --- |
| Developer Portal | Pi Browser → `develop.pi` |
| Validation file | `<app URL>/validation-key.txt` ← env `PI_VALIDATION_KEY` |
| Health check | `<app URL>/api/health` |
| Operator console | `<app URL>/admin` (paste `ADMIN_API_KEY`) |
| PiNet address | Developer Portal → your app → **PiNet Settings** |
| Platform API base | `https://api.minepi.com/v2`, header `Authorization: Key <server key>` |

## Sources

- [Pi Apps Platform for Developers](https://minepi.com/developers/)
- [pi-platform-docs — Developer Portal](https://github.com/pi-apps/pi-platform-docs/blob/master/developer_portal.md)
- [pi-platform-docs — SDK reference](https://github.com/pi-apps/pi-platform-docs/blob/master/SDK_reference.md)
- [pi-platform-docs — Platform API](https://github.com/pi-apps/pi-platform-docs/blob/master/platform_API.md)
- [pi-platform-docs — Payments](https://github.com/pi-apps/pi-platform-docs/blob/master/payments.md)
- [Community Developer Guide — Developer Portal](https://pi-apps.github.io/community-developer-guide/docs/gettingStarted/devPortal/)
- [Community Developer Guide — Getting-started checklist](https://pi-apps.github.io/community-developer-guide/docs/gettingStarted/gettingStartedChecklist/)
- [Community Developer Guide — PiNet](https://pi-apps.github.io/community-developer-guide/docs/importantTopics/piNet/)
- [.pi Domain Reservation announcement](https://minepi.com/blog/pi-domain-reservation/)
