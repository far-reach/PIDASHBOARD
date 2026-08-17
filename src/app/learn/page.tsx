import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { LearnSectionNav } from "@/components/LearnSectionNav";

export const metadata: Metadata = { title: "Learn · Cyberekt" };

/**
 * Educational content: how to read the market data this app reports.
 *
 * Scoped deliberately. It explains what the numbers on screen mean and how
 * they can mislead; it does not teach a strategy, name levels, or suggest
 * what anyone should do. See COMPLIANCE.md.
 */

const SECTIONS = [
  { id: "about-app", label: "What this app does" },
  { id: "sources", label: "Where the numbers come from" },
  { id: "distrust", label: "When to distrust the data" },
  { id: "glossary", label: "Glossary" },
  { id: "methodology", label: "How the comparisons work" },
  { id: "daily-report", label: "The daily report" },
  { id: "risk", label: "Risk, plainly" },
] as const;

// Anchored sections scroll to just below the sticky rows (header + title bar).
const SECTION_ANCHOR = "scroll-mt-32";

export default function LearnPage() {
  return (
    <div className="space-y-3 pb-4 max-w-2xl">
      <div className="sticky top-16 z-30 -mx-4 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <h1 className="text-lg font-semibold">How to read Cyberekt</h1>
        <LearnSectionNav sections={[...SECTIONS]} />
      </div>

      <Card id="about-app" className={SECTION_ANCHOR}>
        <CardHeader>
          <CardTitle>What this app does, and what it does not</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed">
          <p>
            Cyberekt reports what the PIUSDT market <em>did</em>: prices as published by
            public exchanges, with the source and timestamp shown, and an automatic daily
            summary of the session.
          </p>
          <p className="text-muted-foreground">
            It does not forecast prices, assert what any asset is worth, recommend buying or
            selling, or set levels to trade against. It is a record of observed market data,
            for informational and educational use only.
          </p>
        </CardContent>
      </Card>

      <Card id="sources" className={SECTION_ANCHOR}>
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

      <Card id="distrust" className={SECTION_ANCHOR}>
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

      <Card id="glossary" className={SECTION_ANCHOR}>
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

      <Card id="methodology" className={SECTION_ANCHOR}>
        <CardHeader>
          <CardTitle>How the comparisons work</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-2">
          <p>
            The home screen says things like &quot;wider than 23% of days&quot; and
            &quot;0.68× the usual day&quot;. Every one of those comparisons is arithmetic on
            the same venue&apos;s own daily candles for roughly the last 30 days, so you can
            check them against the chart yourself.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Price movement</strong>: today&apos;s high
              minus its low, as a percentage of the low, ranked against the same figure for
              each of the previous days.
            </li>
            <li>
              <strong className="text-foreground">Trading activity</strong>: volume so far
              today divided by the median volume of a complete day. Because today is
              usually unfinished, the app shows how much of the UTC day has elapsed next to
              it, and never scales the number up to guess a full-day total.
            </li>
            <li>
              <strong className="text-foreground">Where price sits</strong>: the lowest low
              and highest high across those days form a band, and the current price is
              placed inside it.
            </li>
            <li>
              <strong className="text-foreground">Venue agreement</strong>: the widest gap
              between the venues quoting at that moment, as a percentage of their midpoint.
            </li>
          </ul>
          <p>
            The median is used rather than the average because one frantic day would drag an
            average upwards and make every ordinary day afterwards look quiet by comparison.
          </p>
          <p>
            All of it is descriptive: it says what the recorded data shows and nothing else.
            Past behaviour indicates nothing about what happens next, and none of these
            figures is a recommendation to do anything.
          </p>
        </CardContent>
      </Card>

      <Card id="daily-report" className={SECTION_ANCHOR}>
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

      <Card id="risk" className={SECTION_ANCHOR}>
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
