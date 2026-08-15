"use client";

/**
 * The paywall surface for freemium mode. Deliberately narrow in what it
 * claims: Pro unlocks the CURRENTLY-OPEN calls, never the track record. The
 * copy says so explicitly, because a paywall that implies hidden performance
 * is the exact pattern this product exists not to be.
 *
 * Rendered only when the server reports freemium mode and the viewer has no
 * active subscription — the gate itself is enforced server-side; this is just
 * the way to pay.
 */
import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useMe } from "@/lib/hooks";
import { subscribeWithPi } from "@/lib/pi/client";
import { fmtUtcDate } from "@/lib/format";

export function UpgradeCard({ hiddenOpenCount }: { hiddenOpenCount: number }) {
  const { data, refetch } = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const price = Number(process.env.NEXT_PUBLIC_PRO_PRICE_PI ?? 1);

  if (!data || data.monetization !== "freemium") return null;

  if (data.subscription.active) {
    return (
      <Card data-testid="pro-active">
        <CardContent className="pt-4 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm">
            Pro is active — open calls are visible to you.
          </span>
          <Badge tone="up">until {fmtUtcDate(data.subscription.expiresAt)}</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="upgrade-card">
      <CardHeader>
        <CardTitle>Pro — see the open calls</CardTitle>
        <Badge tone="primary">{price} π / 30 days</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed">
          {hiddenOpenCount > 0
            ? `${hiddenOpenCount} call${hiddenOpenCount > 1 ? "s are" : " is"} open right now. `
            : ""}
          Pro shows the levels on calls while they are still live. Everything that lets you
          judge us — every closed call, the full performance record, drawdowns included —
          stays free for everyone, always.
        </p>

        {!data.user ? (
          <p className="text-xs text-muted-foreground">
            Sign in with Pi first (top right). Payment happens in Pi Browser.
          </p>
        ) : done ? (
          <p className="text-sm text-up">Payment confirmed — Pro is active.</p>
        ) : (
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              subscribeWithPi(price)
                .then(() => {
                  setDone(true);
                  void refetch();
                })
                .catch((e: Error) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Waiting for Pi…" : `Subscribe with Pi — ${price} π`}
          </Button>
        )}

        {error ? <p className="text-xs text-down">{error}</p> : null}

        <p className="text-[11px] text-muted-foreground">
          Payment is verified on our server with the Pi platform before access is granted.
          Not financial advice; a subscription buys visibility, not results.
        </p>
      </CardContent>
    </Card>
  );
}
