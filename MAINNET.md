# Mainnet launch checklist

The runbook for moving Cyberekt from Testnet to the Mainnet ecosystem listing.
Work top to bottom; every step states where it happens and how to verify it.
COMPLIANCE.md is the companion document: it holds the reasoning, this file
holds the actions.

## 0. Before touching the portal

- [ ] **Send the compliance question** (COMPLIANCE.md section 6, reproduced at the
      bottom of this file) through the Developer Portal support channel or the Pi
      developer community. **Wait for the answer and paste it into COMPLIANCE.md**
      with the date. Submitting without it risks the listing and the developer
      account; the app's core feature is the subject of the rule in question.
- [ ] **Create a fresh mainnet wallet** in Pi Browser for receiving tips.
      Never paste its seed phrase anywhere: not in chat, not in a file, not in
      an env var. (The testnet wallet whose seed was shared during testing must
      not be reused on mainnet.)

## 1. Register the mainnet app (Developer Portal, in Pi Browser)

Mainnet is a separate registration from the Testnet app; the Testnet app stays
as-is for future testing.

- [ ] develop.pi -> New App -> network: **Pi Mainnet**. Name: **Cyberekt**
      (never "Pi<anything>"; see COMPLIANCE.md section 1).
- [ ] App URL: `https://cyberekt.vercel.app` — exactly this, no path, no
      trailing content.
- [ ] Generate the mainnet **API key** and copy it (next section). Do not
      paste it into chats or commit it.
- [x] Copy the mainnet **validation key** shown in the "Verify Domain
      Ownership" step. **Done:** the Mainnet key is committed in
      `src/app/validation-key.txt/route.ts` and served at
      `https://cyberekt.vercel.app/validation-key.txt`.

## 2. Vercel environment variables (Settings -> Environment Variables)

| Variable | Action | Why |
| --- | --- | --- |
| `PI_API_KEY` | **Replace** with the mainnet app's API key | The testnet key is rejected on mainnet; payments would 401 |
| `PI_VALIDATION_KEY` | **Leave unset / delete it** | The Mainnet key is now the committed fallback and is served automatically. If this variable is set to the old Testnet key it OVERRIDES the correct one and verification keeps failing |
| `NEXT_PUBLIC_PI_SANDBOX` | Confirm `false` (already done) | Sandbox handshake hangs in the real Pi Browser |
| `NEXT_PUBLIC_SIGNALS_ENABLED` | Confirm **unset** (or `false`) | Directional calls stay off; COMPLIANCE.md section 2 |
| `CRON_SECRET` | Recommended: set (any random string, 16+ chars) | Authorizes the daily 00:05 UTC report cron. The archive now self-heals: if the cron never runs, yesterday's report is generated on first request. The cron is still the tidy path |
| `SESSION_SECRET` | Already set (production refuses to boot without it) | — |
| `DATABASE_URL` | Already set (production refuses to boot without it) | — |

After changing variables: **Deployments -> latest -> Redeploy** (env vars only
apply to new deployments).

## 3. Verify, in Pi Browser, on the live domain

- [ ] `https://cyberekt.vercel.app/validation-key.txt` shows the **mainnet**
      key -> complete "Verify Domain Ownership" in the portal.
- [ ] `https://cyberekt.vercel.app/pi-check` -> "Test sign-in" succeeds and
      "Check session" returns your username.
- [ ] Send one **small real tip** (0.1 pi minimum) end-to-end; confirm the
      success state. This exercises approve + complete against the mainnet
      platform API with the new key.
- [ ] `https://cyberekt.vercel.app/reports` shows yesterday's report.
- [ ] `https://cyberekt.vercel.app/api/health` reports database and feed ok.

## 4. Store listing (portal)

- [ ] Subtitle, description, and category (finance / education) as prepared.
- [ ] Capture ~5 real screenshots from the live app in Pi Browser (dashboard,
      chart expanded, reports, learn, network panel).
- [ ] Icon and listing images uploaded.

## 5. After the listing is approved

- [ ] Delete `src/app/pi-check/` (diagnostics page; it leaks nothing but has
      no business being public forever) and push.
- [ ] Record the approval date and any reviewer feedback in COMPLIANCE.md.
- [ ] Keep accumulating daily reports; the archive is the product's memory.

## The compliance question (paste as-is)

> My app displays live PI/USDT market data sourced from public exchanges (OKX,
> MEXC), together with an automatically generated daily summary of that data —
> open, high, low, close, volume and funding rate — plus educational material
> on how to read market data. It publishes no forecasts, no recommendations,
> and no claims about what Pi is or will be worth.
>
> 1. Is displaying third-party exchange market data for PI permitted for an
>    app listed in the Mainnet ecosystem, given the guideline prohibiting
>    material discussions or representations regarding the value or valuation
>    of Pi?
> 2. If it is permitted, are there presentation requirements — for example
>    attribution to the source exchange, or specific disclaimer wording?
> 3. Separately: would publishing directional trading signals (entry,
>    stop-loss, target) on PI be permitted for a listed app, or is that
>    outside what the guidelines allow?
