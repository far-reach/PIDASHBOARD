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

- **App name:** `PiPulse`
  (Letters, numbers and spaces only — the portal rejects special characters.)
- **Category:** Finance · **Secondary:** Education
- **Audience:** Pioneers who follow the PI market.

## 3. Short description (paste as-is)

> Live PIUSDT price from multiple exchanges, an automatic daily market report, and a
> transparent trading-signal record where every call — winning or losing — is permanent.
> Educational information only; not financial advice.

## 4. Long description (paste as-is)

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

1. **Home** — price hero + chart + latest daily report.
2. **Signals** — the feed with at least one closed call visible.
3. **Performance** — equity curve and stats, drawdown included.
4. **Reports** — a generated daily report.
5. **Learn** — the education screen (shows this is informational, not advisory).

Portrait, full screen, no debug overlays, no `/admin` screen in any shot.

## 7. Answers to the questions reviewers ask

**Does the app give financial advice?**
> No. PiPulse publishes market data and its own model's analysis as educational
> information. A disclaimer appears in the footer of every screen, a risk banner appears
> on first visit each session, and a dedicated risk page is linked throughout.

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
> Tips buy nothing — they are voluntary support and the UI says so. The optional Pro
> subscription gates only *currently-open* signals; the complete closed history and the
> full performance record are free to everyone, permanently.

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
| ≥ 20 closed signals in the record | — | ⬜ **The one-month clock** |
| ~30 days of daily reports | — | ⬜ |
| No feed gap > 5 min over 7 days | — | ⬜ |
| Screenshots captured | — | ⬜ |

## 9. What must never change to get listed

If a reviewer or any advice suggests otherwise, these stay as they are — they are the
product:

- Closed signal history and the performance page stay **free**, in every mode.
- Losing calls stay as visible as winning ones. Nothing is deleted; nothing is edited.
- Tips unlock nothing.
- No claim of guaranteed returns, anywhere, ever.
