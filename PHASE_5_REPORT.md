# Phase 5 Report — Submission to Pi App Directory

## Status: **BLOCKED — do not submit yet** (by design, per brief §5/§7)

Everything the codebase can provide for submission exists; the remaining items are
operational and operator-owned. This report is the live checklist.

## Ready now

- [x] Submission-grade codebase: tests green (60 unit + 15 E2E), typecheck + lint clean,
      production build verified
- [x] Legal pages routed at stable URLs (`/legal/terms`, `/legal/privacy`, `/legal/risk`)
      and linked from every screen's footer
- [x] App icon master (`public/icon.svg`), PWA manifest, app description (README intro
      doubles as directory copy draft)
- [x] Phase 0–4 reports written
- [x] CI pipeline (GitHub Actions) enforcing the quality bar on every push

## Blocked — operator checklist (in order)

- [ ] Confirm/amend the three Phase 0 decision docs (SIGNAL_SOURCING, DATA_SOURCES,
      MONETIZATION)
- [ ] Deploy web + worker (README runbook); run `db:migrate`; set real secrets
- [ ] **7-day ingestion soak** with no freshness loss > 5 min (brief §7.5) — evidence
      into PHASE_1_REPORT
- [ ] Pi Developer account, app registration, `PI_API_KEY`; sandbox auth + payment
      end-to-end with screenshots — evidence into PHASE_4_REPORT
- [ ] Real-device Pi Browser pass (brief §7.7) — screenshots archived
- [ ] Legal review of the three draft pages by qualified counsel (brief §Phase 5.2)
- [ ] Sentry wired (DSN + `@sentry/nextjs`), uptime monitor on `/api/health` (brief §7.9)
- [ ] **Run publicly for ≥ 1 month** building real report + signal history before
      submitting (brief §8 — "empty history is worse than not launching")
- [ ] Prior-art scan of existing PIUSDT apps in the directory (Phase 0.6 leftover)
- [ ] Submit via the Pi Developer Portal per the process current at that date; address
      reviewer feedback
- [ ] **Operator sign-off in writing** (brief §7.10)

## Recommendation

Deploy to production infrastructure now; start the soak + history clock; submit only
when every box above is checked.
