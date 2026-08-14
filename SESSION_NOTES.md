# SESSION_NOTES

## 2026-08-14 — initial build (full v1 codebase)

**What was done:** Everything in Phase 0–4 code scope, from empty repo to a tested,
building app. See PHASE_0..5 reports. 60 unit + 15 E2E tests green; `npm run build`,
`lint`, `typecheck` clean. Stack: Next.js 15 / TS strict / Tailwind / Lightweight
Charts / TanStack Query / zod / Postgres (PGlite in dev) / optional Redis.

**Deviations from the brief, with reasons (documented in the phase reports):**
- npm instead of pnpm (host tooling; script names match the brief's appendix)
- MEXC via REST not WS (their v3 stream is protobuf; adequate for a failover source)
- No push notifications or email (no third-party Pi push API exists; §3.10 bans email —
  the non-negotiable outranks §Phase 4.3)
- Sentry left as a deploy step (DSN + wizard), not a hard dependency

**What surprised me:**
- The sandbox proxy blocks exchange APIs (403) → live-feed soak must happen post-deploy;
  everything network-dependent is failover/unit-tested against simulated sources.
- `Infinity` histogram edges died in JSON and flipped a win bin to the loss color —
  caught from a screenshot, fixed with finite sentinels + regression test.
- PGlite needs `exec()` for multi-statement migrations.

**What the next session should do first:**
1. `git status && npm test && npm run build` — start green.
2. If the operator has confirmed the Phase 0 docs: deploy (README runbook), start the
   7-day soak, run the Pi sandbox auth+payment test, paste evidence into the reports.
3. If any exchange changed its API: `test/failover.test.ts` still passes (fakes), but
   check `src/lib/market/*.ts` response shapes against live responses after deploy.
4. Keep `is_test=true` on all signals until launch day.
