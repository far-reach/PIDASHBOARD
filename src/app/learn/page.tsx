import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Learn · Cyberekt" };

/**
 * Educational content: how to read the market data this app reports.
 *
 * Scoped deliberately. It explains what the numbers on screen mean and how
 * they can mislead; it does not teach a strategy, name levels, or suggest
 * what anyone should do. See COMPLIANCE.md.
 */
export default function LearnPage() {
  return (
    <div className="space-y-3 pb-4 max-w-2xl">
      <h1 className="text-lg font-semibold">How to read Cyberekt</h1>

      <Card>
        <CardHeader>
          <CardTitle>Where these numbers come from</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-2">
          <p>
            Every price here is reported by a public exchange, OKX first with MEXC as backup,
            and is shown with its source and the time it was observed. Nothing is our own
            estimate of what anything is worth. We report; we do not appraise.
          </p>
          <p>
            Exchanges disagree. Prices differ between venues at the same instant because each
            has its own order book and its own participants. A price is always &quot;the price
            at this venue, at this moment&quot;, never a single universal number.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to distrust what you see</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-2">
          <p>
            Data can be wrong or late, and the honest thing is to say so on screen rather than
            show a confident-looking number. Watch for these:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">Stale</strong>: the last observation is more
              than 60 seconds old. The number on screen is history, not the market now.
            </li>
            <li>
              <strong className="text-foreground">Failover</strong>: the primary exchange is
              unreachable and prices are coming from the backup venue.
            </li>
            <li>
              <strong className="text-foreground">Offline · last known</strong>: your device
              lost connection and you are looking at cached data.
            </li>
          </ul>
          <p>
            If a badge is showing, treat the number as a rough indication at best.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Glossary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="text-sm space-y-2">
            {(
              [
                ["Bid", "The highest price a buyer is currently willing to pay at that venue."],
                ["Ask", "The lowest price a seller is currently willing to accept."],
                [
                  "Spread",
                  "The gap between bid and ask. A wide spread usually means thin liquidity, so trades move the price more easily.",
                ],
                [
                  "24h volume",
                  "How much changed hands over the last day. Low volume makes a price less meaningful: few trades can move it a long way.",
                ],
                [
                  "OHLC",
                  "Open, high, low and close: the four prices that summarise a period. Each candle on the chart is one period.",
                ],
                [
                  "Funding rate",
                  "A periodic payment between holders of long and short perpetual-futures positions. It indicates how crowded each side is; it is not a forecast.",
                ],
                [
                  "Failover",
                  "When the primary exchange feed drops, prices come from the secondary source and are badged as such.",
                ],
                [
                  "Stale",
                  "Data older than 60 seconds is flagged. Prices move; old data misleads.",
                ],
              ] as const
            ).map(([term, def]) => (
              <div key={term}>
                <dt className="font-medium">{term}</dt>
                <dd className="text-muted-foreground leading-relaxed">{def}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What the daily report is</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-2">
          <p>
            Once per day the app summarises the session that just ended: where it opened and
            closed, the range it covered, the busiest hours, how volume compared with recent
            days, and the funding context. It is generated from the recorded data, describes
            only what already happened, and contains no forecast.
          </p>
          <p>
            Published reports are never edited or deleted afterwards, and that includes the dull
            ones from quiet days. An archive you can only trust when it flatters us would be worth
            nothing.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk, plainly</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-2">
          <p>
            Crypto markets are speculative and volatile. You can lose everything you commit.
            Nothing in this app accounts for your situation, and no record of the past predicts
            the future. Never commit money you cannot afford to lose, and consider consulting a
            licensed professional before making financial decisions.
          </p>
          <p>
            Cyberekt never executes trades, never holds funds, and never asks for exchange
            API keys or wallet keys. Anyone claiming otherwise in our name is a scam.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
