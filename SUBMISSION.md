# Submission pack — everything the Pi Developer Portal will ask you for

`PUBLISHING.md` is the *procedure*. This file is the *content*: the values, copy and
answers to have on hand, so no portal step sends you hunting.

Keep this file updated as you fill it in — it doubles as the record of what you submitted.

---

## 1. Fill these in as you go

| Field | Value | Where it comes from |
| --- | --- | --- |
| App URL (HTTPS) | `________________` | Vercel, after first deploy |
| PiNet URL | `________________` | Portal → PiNet Settings |
| Testnet App ID | `________________` | Portal, after registering the Testnet app |
| Mainnet App ID | `________________` | Portal, after registering the Mainnet app |
| Validation key | `________________` | Portal → set as env `PI_VALIDATION_KEY` |
| Server API key (Testnet) | *password manager* | Portal → never commit this |
| Server API key (Mainnet) | *password manager* | Portal → never commit this |
| App wallet address | `________________` | Portal → this is where your Pi arrives |
| Support contact | `________________` | Your choice → env `NEXT_PUBLIC_SUPPORT_CONTACT` |

---

## 2. App identity

- **App name:** `Cybrekt Market`
  (Letters, numbers and spaces only — the portal rejects special characters.)
- **Category:** Finance · **Secondary:** Education
- **Audience:** Pioneers who follow the PI market.

## 3. Short description (paste as-is)

> Live PI/USDT market data from public exchanges, with an automatic daily summary of each
> session and a permanent archive of those reports. Informational and educational only —
> no forecasts, no recommendations, not financial advice.

## 4. Long description (paste as-is)

> Cybrekt Market gives Pioneers a clear, honest view of what the PI/USDT market actually
> did.
>
> • Live price aggregated from public exchanges (OKX and MEXC), with automatic failover
>   and a visible badge whenever data is stale or coming from the backup source — you can
>   always see where a number came from and how old it is.
> • Candlestick charts across 1m / 5m / 1h / 1d with volume.
> • An automatic daily report: the session's open, high, low and close, notable hourly
>   moves, observed ranges, volume anomalies and funding context — a factual summary of
>   the session, generated from the data.
> • A permanent archive of every daily report, which is never edited after publication.
> • Educational content explaining how to read market data, what the figures mean, and a
>   glossary of terms.
>
> What Cybrekt Market deliberately does not do: it publishes no price forecasts, no
> valuation claims, no buy or sell recommendations and no trading levels. It never
> executes trades, never holds your funds, and never asks for exchange or wallet keys.
>
> It is an independent community app, not affiliated with or endorsed by the Pi Core Team.
> All content is informational and educational; nothing in the app is financial advice.

## 5. Icons — already in the repo

Upload from `public/` whichever sizes the portal requests:

| File | Size | Use |
| --- | --- | --- |
| `icon-512.png` | 512×512 | Primary app icon |
| `icon-maskable-512.png` | 512×512 | Adaptive / maskable icon |
| `icon-192.png` | 192×192 | Small icon |
| `apple-touch-icon.png` | 180×180 | iOS home screen |
| `icon.svg` | vector | Wherever SVG is accepted |

## 6. Screenshots — capture these five, on a real phone

Take them **in Pi Browser on your own phone**, from your live deployment, *after* real
data exists. Do not mock them up: a listing screenshot that shows data the app never
served is misleading, and reviewers do compare.

1. **Home** — price hero + stats + chart.
2. **Home, scrolled** — the latest daily report, and the "what this app does and does not
   do" card. This one is worth including: it shows a reviewer the disclaimer up front.
3. **Reports** — the archive, with a generated daily report open.
4. **Learn** — the education screen (shows this is informational, not advisory).
5. **A legal page** — Risk or Terms, showing the disclaimers are real pages.

Portrait, full screen, no debug overlays, no `/admin` screen in any shot.

## 7. Answers to the questions reviewers ask

**Does the app give financial advice?**
> No. Cybrekt Market reports market data published by public exchanges and generates a
> factual daily summary of it. It publishes no forecasts, no valuation claims, no buy or
> sell recommendations and no trading levels. A disclaimer appears in the footer of every
> screen, a risk banner appears on first visit each session, and a dedicated risk page is
> linked throughout.

**Does the app make claims about the value of Pi?**
> No. It displays price data as published by third-party exchanges, always attributed to
> its source venue and timestamped, and states in-app that this is observed market data
> rather than any statement of what Pi is worth. It contains no forecasts and no
> valuation claims. See COMPLIANCE.md in the repository for how this is enforced in code
> and in CI.

**Does it custody funds or touch wallets?**
> No. It never executes trades, never holds funds, and never requests exchange or wallet
> keys. The only wallet interaction is the standard Pi payment flow.

**What data do you collect?**
> Pi user ID and username, only when the user chooses to sign in; plus payment identifiers
> for tips and subscriptions. No email, phone, location, contacts, analytics or ad
> trackers. See `/legal/privacy`.

**How are payments handled?**
> Through the official Pi SDK and Platform API only: `createPayment` → server-side
> `/approve` → server-side `/complete`. The server re-reads every payment from the Pi
> platform and verifies owner, product and amount before granting anything. A client-side
> claim of payment grants nothing.

**What do payments buy?**
> Nothing. The only payment in the app is a voluntary tip supporting its running costs,
> and the UI states plainly that it unlocks no content and grants no access. Every feature
> is free to every Pioneer.

**Is the app affiliated with Pi Core Team?**
> No, and it says so in the footer of every screen and in the Terms.

## 8. Pre-submission checklist

Everything in the code column is already true in this repo. The operator column is yours.

| | Code | Operator |
| --- | --- | --- |
| Pi SDK auth, server-verified | ✅ | Test once in Pi Browser |
| Payments verified server-side | ✅ | Test once in sandbox |
| `validation-key.txt` served byte-exact | ✅ | Set `PI_VALIDATION_KEY` |
| Disclaimer on every screen | ✅ | — |
| Terms / Privacy / Risk pages live | ✅ | ⬜ Reviewed by counsel |
| Support contact published | ✅ | ⬜ Set `NEXT_PUBLIC_SUPPORT_CONTACT` |
| PWA manifest + icons | ✅ | — |
| Mobile layout, no h-scroll (E2E-tested) | ✅ | ⬜ Eyeball on your phone |
| CI green on `main` | ✅ | ⬜ Check before submitting |
| App name not in "Pi&lt;Name&gt;" form | ✅ | — |
| App URL does not start with "pi" | — | ⬜ **Name the Vercel project carefully** |
| No directional trading calls shipped | ✅ | — |
| No external redirects | ✅ | — |
| ~30 days of daily reports in the archive | — | ⬜ **The one-month clock** |
| No feed gap > 5 min over 7 days | — | ⬜ |
| Screenshots captured | — | ⬜ |
| Compliance question sent to Pi, answer recorded | — | ⬜ See COMPLIANCE.md §6 |

## 9. What must never change to get listed

If a reviewer or any advice suggests otherwise, these stay as they are — they are the
product:

- Every feature stays **free**. Tips unlock nothing.
- Published daily reports are never edited or deleted after the fact.
- Data is always attributed to its source exchange and timestamped; a stale or
  failed-over feed always says so on screen.
- No forecast, no valuation claim, no guaranteed-return language, anywhere, ever.
- No directional trading calls without written permission from Pi **and** legal advice
  (COMPLIANCE.md §2, §4).
