import type { Metadata } from "next";

export const metadata: Metadata = { title: "Risk Disclaimer — Cybrekt Market" };

export default function RiskPage() {
  return (
    <article className="max-w-2xl pb-4 text-sm leading-relaxed space-y-3">
      <h1 className="text-lg font-semibold">Risk Disclaimer</h1>
      <p className="text-xs text-muted-foreground">
        Draft template — to be reviewed by qualified counsel before App Directory submission.
      </p>
      <p>
        Cybrekt Market provides market data, automatically generated reports, and model-based trading
        signals for educational and informational purposes only. Nothing in this app constitutes
        financial, investment, legal, or tax advice, an offer or solicitation to buy or sell any
        asset, or a recommendation tailored to any person.
      </p>
      <p>
        Trading cryptocurrencies, including the PIUSDT pair, involves substantial risk of loss and
        is not suitable for every person. Prices are volatile; liquidity can vanish; exchanges can
        fail. You can lose the entire amount you commit. Signals published in this app reflect the
        output of an analytical model; they are frequently wrong, and their historical performance
        — which we display in full, including losses — does not indicate future results.
      </p>
      <p>
        Cybrekt Market does not execute trades, does not custody funds, and does not access your exchange
        accounts or wallets. Any trading decision you make, on any venue, is yours alone. Before
        making financial decisions, consider your circumstances and consult a licensed professional
        in your jurisdiction.
      </p>
      <p>
        Market data is aggregated from third-party exchanges and may be delayed, interrupted, or
        inaccurate. Timestamps and source badges are shown so you can judge freshness; do not act
        on data marked stale or offline.
      </p>
    </article>
  );
}
