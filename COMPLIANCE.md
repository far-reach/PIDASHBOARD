# Pi ecosystem compliance — decisions and their reasons

Why this app looks the way it does. Read this before changing the app name, re-enabling
signals, or adding an outbound link.

**Status of the research:** the rules below were gathered from Pi's published guidelines
via search. The primary pages (`minepi.com`, `pi-apps.github.io`) could not be fetched
directly from the build environment, so **every rule marked ⚠️ must be confirmed against
the live document in Pi Browser before submission.** Where this file and the current
official documents disagree, the documents win.

---

## 1. The app name may not be "Pi<Something>" ⚠️

> "Your app name may **NOT** be in the form of 'Pi App_Name' to avoid Pioneers confusion
> that your app was created by the Pi Core Team."
> — [Pi Trademark Usage](https://minepi.com/blog/pi-trademark-usage/)

Also: using "Pi" in an app name at all requires an executed **Trademark Licensing
Agreement**, and *"your app's URL/domain must not start with 'pi'"*
([Mainnet Listing Requirements](https://pi-apps.github.io/community-developer-guide/docs/gettingStarted/mainnetListingRequirements/)).

**Decision:** the app is named **Cyberekt Market** — no "Pi" in the name, so no trademark
agreement is needed and the domain rule is satisfied automatically. It was previously
"PiPulse", which was in the prohibited form.

Pinned by `test/compliance.test.ts`.

**Consequence for hosting:** the deployment URL must not start with `pi`. Use
`cyberekt-market.vercel.app` or similar — never `pipulse.vercel.app`.

## 2. No claims about the value or valuation of Pi ⚠️

> "**Material discussions, representations or misrepresentations regarding the value or
> valuation of Pi are prohibited.**"
> — [Pi App Studio Community Guidelines](https://minepi.com/appstudio_community_guidelines/)

Enforcement is explicit: violating apps may be paused or removed, and *"repeat offenders
could face stricter penalties such as permanent removal from the Pi system."* That reaches
the developer's account, not just the app.

**Decision:** directional trading calls — entry, stop-loss, target, and the win-rate
record derived from them — **do not ship enabled**. `NEXT_PUBLIC_SIGNALS_ENABLED` defaults
to `false` and the gate is enforced server-side in the API, not merely hidden in the nav.

What the app does instead, and considers defensible:

| Ships enabled | Why it should be acceptable |
| --- | --- |
| Live PIUSDT price from public exchanges | Factual, attributed, timestamped third-party data — reporting what a market did, not asserting what Pi is worth |
| Candlestick charts | Same |
| Automatic daily report (OHLC, ranges, volume, funding) | Descriptive summary of observed data; contains no forecast and no recommendation |
| Education (`/learn`) | Explains how to read market data |
| Voluntary tips | Payment for support; buys nothing |

**Known residual risk, stated plainly:** an app centred on PI price data is *adjacent* to
this rule even without signals. The wording quoted above is from the **App Studio**
guidelines, which govern no-code App Studio apps; whether it binds a self-hosted SDK app
identically was **not confirmed**. Counter-evidence: OKX, Bitget, MEXC and Gate.io appear
in the Pi ecosystem interface, so price data is plainly not banned outright — but those
are exchange partners, not community apps.

**Before submitting, ask Pi directly** (see §6) and record the answer here.

## 3. No external redirects ⚠️

> "Apps should not redirect users to external websites, apps or services."

**Decision:** the only outbound host anywhere in the UI is `sdk.minepi.com`, which is the
official SDK and required for the app to function. No documentation links, no social
links, no exchange links. Pinned by `test/compliance.test.ts`.

If you ever add an outbound link, that test fails — that is the intent.

## 4. Trading signals are regulated independently of Pi

Publishing entry/stop/target calls can constitute investment advice regardless of
disclaimers, in many jurisdictions. This is a second, separate reason the signals engine
ships disabled, and it does not go away if Pi says yes.

**If you re-enable signals, get legal advice first** — not only Pi's permission.

## 5. Rules already satisfied

| Requirement | Status |
| --- | --- |
| Developer KYC completed | ✅ operator |
| Pi Authentication SDK for login | ✅ integrated, server-verified |
| Collect only essential data | ✅ Pi uid + username + payment ids; no email, no analytics, no trackers |
| No gambling, betting or lottery mechanics | ✅ none |
| No use of Pi's logo, colours or design elements | ✅ own branding |
| Not implying Pi Core Team affiliation | ✅ disclaimed in footer of every screen and in Terms |
| Payments via official SDK + Platform API | ✅ server-verified approve/complete |

## 6. The question to ask Pi before submitting

Send this through the Developer Portal support channel or the Pi developer community, and
**paste the answer into this file** with the date:

> My app displays live PI/USDT market data sourced from public exchanges (OKX, MEXC),
> together with an automatically generated daily summary of that data — open, high, low,
> close, volume and funding rate — plus educational material on how to read market data.
> It publishes no forecasts, no recommendations, and no claims about what Pi is or will be
> worth.
>
> 1. Is displaying third-party exchange market data for PI permitted for an app listed in
>    the Mainnet ecosystem, given the guideline prohibiting material discussions or
>    representations regarding the value or valuation of Pi?
> 2. If it is permitted, are there presentation requirements — for example attribution to
>    the source exchange, or specific disclaimer wording?
> 3. Separately: would publishing directional trading signals (entry, stop-loss, target)
>    on PI be permitted for a listed app, or is that outside what the guidelines allow?

**Answer received:** _(date, channel, and the answer verbatim — fill this in)_

---

## Re-enabling signals later

Only after §6 question 3 is answered **yes in writing**, and after legal advice:

0. Restore the signal-resolution cron. `vercel.json` ships with only the daily
   report cron, because the `/api/cron/resolve` job exists solely to settle open
   directional calls — with none published it has nothing to do, and Vercel's
   Hobby plan permits one run per day anyway. Re-enabling signals means adding
   back `{"path": "/api/cron/resolve", "schedule": "*/5 * * * *"}` **and** an
   account that allows sub-daily crons, or the always-on worker
   (`npm run worker:resolve`). Do not re-enable signals on a daily resolve
   cadence: a call that hit its stop at 09:00 and is not booked until midnight
   is a dishonest record, which defeats the point of the engine.
2. The nav, home screen, `/signals`, `/performance` and the APIs all come back — the
   engine was never deleted and its tests never stopped running (the E2E suite exercises
   the full lifecycle with the flag on).
3. Record the permission in this file, with the date and who gave it.
