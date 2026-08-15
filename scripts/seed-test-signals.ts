/**
 * Seed a realistic mixed history of TEST signals (marked is_test AND
 * rationale-prefixed) so the performance page, feed, and E2E tests have
 * data. Deterministic PRNG → identical seed every run. Never run against a
 * production database that already carries real signals — test data is
 * excluded from public queries by default anyway (is_test = true).
 *
 * Usage: npm run db:seed              (25 closed + 2 open signals, is_test=true)
 *        SEED_PUBLIC=1 npm run db:seed (same data marked public — staging demos ONLY;
 *                                       never against a production db)
 */
import { createDb } from "../src/lib/db";
import { createSignal, insertEvent } from "../src/lib/signals/repo";
import { SYMBOL } from "../src/lib/env";

// Mulberry32 — tiny deterministic PRNG.
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RATIONALES = [
  "Higher-timeframe support retest with declining sell volume; model favors a bounce scenario.",
  "Break above prior-week high on rising volume; historically this pattern has continued in ~55% of cases.",
  "Funding flipped negative while price held range low — positioning squeeze setup per our model.",
  "Lower-high sequence into resistance; model shows momentum exhaustion.",
  "Volume anomaly at range boundary; mean-reversion setup based on 30-day statistics.",
  "Daily close back inside the prior consolidation; failed-breakout fade per playbook.",
];

async function main(): Promise<void> {
  const db = await createDb();
  const rand = prng(20260814);
  const now = Date.now();
  const day = 24 * 3600 * 1000;

  let price = 0.42; // synthetic PIUSDT-scale price path
  let created = 0;

  // 25 closed signals over the past ~60 days: mixed wins/losses/expiries.
  for (let i = 0; i < 25; i++) {
    const issuedAt = new Date(now - (60 - i * 2.2) * day - rand() * day * 0.5);
    price = Math.max(0.2, price * (1 + (rand() - 0.5) * 0.08));
    const direction = rand() > 0.45 ? "long" : "short";
    const riskPct = 0.03 + rand() * 0.03; // 3-6% stop distance
    const rr = 1.5 + rand() * 1.5; // 1.5R-3R targets
    const entry = round(price);
    const stop = round(direction === "long" ? entry * (1 - riskPct) : entry * (1 + riskPct));
    const target = round(
      direction === "long" ? entry * (1 + riskPct * rr) : entry * (1 - riskPct * rr)
    );

    const signal = await createSignal(
      {
        symbol: SYMBOL,
        direction,
        entry,
        stop,
        target,
        rationale: `[TEST DATA] ${RATIONALES[Math.floor(rand() * RATIONALES.length)]}`,
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(issuedAt.getTime() + 7 * day).toISOString(),
        source: "seed",
        isTest: process.env.SEED_PUBLIC !== "1",
      },
      db
    );

    // Outcome mix ≈ 48% wins / 40% losses / 12% expiries — honest, not flattering.
    const roll = rand();
    const closedAt = new Date(issuedAt.getTime() + (0.5 + rand() * 5) * day);

    // Every seeded signal fills shortly after issue; without a fill event a
    // signal is (correctly) treated as never entered and stays unscored.
    const filledAt = new Date(issuedAt.getTime() + 0.1 * day);
    await insertEvent(
      {
        signalId: signal.id,
        type: "filled",
        price: entry,
        priceSource: "seed",
        note: "entry level traded",
        occurredAt: filledAt.toISOString(),
      },
      db
    );
    if (roll < 0.48) {
      const overshoot = 1 + rand() * 0.004;
      const exit = direction === "long" ? target * overshoot : target / overshoot;
      await insertEvent(
        {
          signalId: signal.id,
          type: "hit_tp",
          price: round(exit),
          priceSource: "seed",
          note: "target level crossed",
          occurredAt: closedAt.toISOString(),
        },
        db
      );
    } else if (roll < 0.88) {
      const slippage = 1 + rand() * 0.006;
      const exit = direction === "long" ? stop / slippage : stop * slippage;
      await insertEvent(
        {
          signalId: signal.id,
          type: "hit_sl",
          price: round(exit),
          priceSource: "seed",
          note: "stop level crossed",
          occurredAt: closedAt.toISOString(),
        },
        db
      );
    } else {
      const drift = 1 + (rand() - 0.5) * 0.02;
      await insertEvent(
        {
          signalId: signal.id,
          type: "expired",
          price: round(entry * drift),
          priceSource: "seed",
          note: "expiry time reached; closed at market",
          occurredAt: new Date(issuedAt.getTime() + 7 * day).toISOString(),
        },
        db
      );
    }
    created++;
  }

  // 2 open signals near "current" synthetic price.
  for (let i = 0; i < 2; i++) {
    const direction = i === 0 ? "long" : "short";
    const entry = round(price * (1 + (rand() - 0.5) * 0.01));
    const stop = round(direction === "long" ? entry * 0.95 : entry * 1.05);
    const target = round(direction === "long" ? entry * 1.1 : entry * 0.9);
    await createSignal(
      {
        symbol: SYMBOL,
        direction,
        entry,
        stop,
        target,
        rationale: `[TEST DATA] ${RATIONALES[Math.floor(rand() * RATIONALES.length)]}`,
        issuedAt: new Date(now - rand() * day).toISOString(),
        expiresAt: new Date(now + 7 * day).toISOString(),
        source: "seed",
        isTest: process.env.SEED_PUBLIC !== "1",
      },
      db
    );
    created++;
  }

  console.log(`seeded ${created} TEST signals (25 closed, 2 open) for ${SYMBOL}`);
  await db.close();
}

const round = (n: number) => Math.round(n * 10000) / 10000;

main().catch((err) => {
  console.error("seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
