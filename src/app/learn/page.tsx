import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Learn — PiPulse" };

/** Educational content (brief §1): how to read the signals, glossary, risk. */
export default function LearnPage() {
  return (
    <div className="space-y-3 pb-4 max-w-2xl">
      <h1 className="text-lg font-semibold">How to read PiPulse</h1>

      <Card>
        <CardHeader>
          <CardTitle>What a signal is — and is not</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-2">
          <p>
            A signal is a timestamped, immutable record of what our model saw: a direction (long or
            short), an entry level, a stop-loss, a take-profit target, and the reasoning. It is
            educational information about one possible scenario — it is not a recommendation to
            trade, and it can be wrong.
          </p>
          <p>
            Once published, a signal can never be edited or deleted. It resolves only by market
            events: the target is hit, the stop is hit, it expires, or the operator closes it early
            with a stated reason and the result booked. That resolution — good or bad — stays in
            the record forever.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reading the numbers: R multiples</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-2">
          <p>
            We measure every outcome in <strong>R</strong> — units of initial risk. The distance
            from entry to stop is 1R. A trade stopped out at its stop is −1R. A win at a target
            twice as far as the stop is +2R.
          </p>
          <p>
            R makes results comparable regardless of position size, and it makes losing normal: a
            system can lose more often than it wins and still be positive if winners are larger
            than losers. That is why we show the average R and the full R distribution, not just
            the win rate.
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
                ["Entry", "The price level at which the scenario assumes a position is opened."],
                ["Stop-loss", "The level that invalidates the scenario; the position is assumed closed at a loss."],
                ["Take-profit", "The level at which the scenario assumes profit is taken."],
                ["Win rate", "Share of closed signals with a positive R. Meaningless without average R."],
                ["Drawdown", "The distance from a peak in cumulative R to the following trough — how bad it got."],
                ["Funding rate", "Periodic payment between perpetual-futures longs and shorts; a crowd-positioning gauge."],
                ["Failover", "When the primary exchange feed drops, prices come from the secondary source and are badged."],
                ["Stale", "Data older than 60 seconds is flagged; don't act on stale prices."],
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
          <CardTitle>Risk, plainly</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-2">
          <p>
            Trading PIUSDT is speculative and volatile. You can lose everything you commit. Nothing
            here accounts for your situation, and no history — however honest — predicts the
            future. Never trade money you cannot afford to lose, and consider consulting a licensed
            professional before making financial decisions.
          </p>
          <p>
            PiPulse never executes trades, never holds funds, and never asks for exchange API keys
            or wallet keys. Anyone claiming otherwise in our name is a scam.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
