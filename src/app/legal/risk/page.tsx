import type { Metadata } from "next";

export const metadata: Metadata = { title: "Risk Disclaimer · Cyberekt" };

export default function RiskPage() {
  return (
    <article className="max-w-2xl pb-4 text-sm leading-relaxed space-y-3">
      <h1 className="text-lg font-semibold">Risk Disclaimer</h1>
      <p className="text-xs text-muted-foreground">
        Draft template. To be reviewed by qualified counsel before App Directory submission.
      </p>
      <p>
        Cyberekt reports market data published by third-party exchanges and generates
        automatic factual summaries of it, for educational and informational purposes only.
        Nothing in this app constitutes financial, investment, legal, or tax advice, an offer or
        solicitation to buy or sell any asset, or a recommendation tailored to any person.
      </p>
      <p>
        The app does not forecast prices, does not state what any asset is or will be worth, does
        not recommend buying or selling, and does not set levels to trade against. A record of
        what a market did in the past is not a guide to what it will do next.
      </p>
      <p>
        Trading cryptocurrencies, including the PIUSDT pair, involves substantial risk of loss and
        is not suitable for every person. Prices are volatile; liquidity can vanish; exchanges can
        fail. You can lose the entire amount you commit.
      </p>
      <p>
        Cyberekt does not execute trades, does not custody funds, and does not access your exchange
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
