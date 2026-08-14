# Phase 2 Report — Dashboard UI (read-only)

## What was done

- Next.js 15 (App Router) + TypeScript strict + Tailwind; hand-rolled shadcn-style
  primitives (`src/components/ui.tsx`) to keep the bundle lean.
- Home: price hero (24h change, range, volume, freshness/source badge), market stats
  grid (bid/ask/spread, 24h H/L), Lightweight-Charts candlestick + volume with
  1m/5m/1h/1d switcher, latest daily report, latest signals.
- Daily report card + `/reports` archive (30 days, date strip selector), rendered by a
  dependency-free markdown subset renderer (no HTML injection).
- Disclaimers: session-dismissible risk banner + permanent footer on every screen,
  legal pages routed.
- Mobile-first: bottom tab bar, 375px-first layout, desktop nav ≥ md.
- PWA: manifest + icon + service worker (shell cache; APIs deliberately uncached),
  localStorage last-known data with explicit "offline · last known" badges, offline
  detection in the nav.
- Chart colors validated for color-vision deficiency (teal/red pair, deutan ΔE 11.6 on
  the dark surface) and always paired with text labels.

## Numbers / verification

- Playwright E2E at 375×812: disclaimer present on all 5 screens; no horizontal
  scroll on any screen; risk-banner dismissal persists per session. 15/15 pass.
- Production build: home page first-load JS ≈ 165 kB shared+page; static pages
  prerendered, API routes dynamic.
- Screenshots (mobile viewport) captured for home, signals, performance, learn.

## What surprised me

- Full-page screenshots exposed a JSON-serialization bug: `Infinity` histogram bin
  edges became `null` and flipped the "≥ 3R" bin to the loss color. Fixed with finite
  sentinels + a regression test. (Exactly the class of honesty bug the brief §8 bans.)

## Known limitations / open questions

- "Charts render < 2s cold load" is met locally; re-verify on the production host.
- Offline mode shows last-known **data** with badges; the chart itself requires a
  network session at least once (candles aren't persisted client-side in v1).
- Real-device Pi Browser rendering pass is an operator/deployment task (Phase 5 list).

## Recommendation

Proceed to Phase 3 (done).
