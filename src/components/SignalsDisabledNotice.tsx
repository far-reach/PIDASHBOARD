import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

/**
 * Shown in place of the signals and performance screens while directional
 * calls are disabled. Kept as a real, explanatory page rather than a 404 so
 * that an old link, a bookmark or a reviewer following a stale screenshot
 * lands on an answer instead of an error.
 */
export function SignalsDisabledNotice() {
  return (
    <div className="space-y-3 pb-4">
      <h1 className="text-lg font-semibold">Not published</h1>
      <Card>
        <CardHeader>
          <CardTitle>This app does not publish trading calls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed">
          <p>
            Cybrekt Market reports observed market data and publishes a factual daily summary.
            It does not publish buy or sell recommendations, entry or exit levels, profit
            objectives, or forecasts of what any asset will be worth.
          </p>
          <p className="text-muted-foreground">
            What you can read here instead: the{" "}
            <Link href="/" className="text-primary hover:underline">
              live market data
            </Link>
            , the{" "}
            <Link href="/reports" className="text-primary hover:underline">
              daily report archive
            </Link>
            , and{" "}
            <Link href="/learn" className="text-primary hover:underline">
              educational material
            </Link>{" "}
            on how market data is read.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
