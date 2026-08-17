"use client";

/**
 * Voluntary tipping — the "send the developer Pi directly" surface.
 *
 * Deliberately unlike the paywall: it unlocks nothing, gates nothing, and says
 * so out loud. It renders in both `free` and `freemium` mode, because the point
 * of a tip is that it is optional support for an app that is already useful.
 *
 * The amount is chosen here but VERIFIED SERVER-SIDE against the payment as the
 * Pi platform reports it (`/api/pi/payments/approve` → `complete`), so nothing
 * on this screen is trusted.
 */
import { useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useMe } from "@/lib/hooks";
import { tipWithPi } from "@/lib/pi/client";

const inputCls = "w-full rounded-md border border-border bg-card px-3 py-2 text-sm";

function presets(): number[] {
  const raw = process.env.NEXT_PUBLIC_TIP_PRESETS ?? "1,5,10";
  const parsed = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parsed.length > 0 ? parsed : [1, 5, 10];
}

export function SupportCard() {
  const { data } = useMe();
  const options = presets();
  const [choice, setChoice] = useState<number | "custom">(options[0] ?? 1);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  const amount = choice === "custom" ? Number(custom) : choice;
  const amountValid = Number.isFinite(amount) && amount > 0;

  if (thanks) {
    return (
      <Card data-testid="support-thanks">
        <CardContent className="pt-4">
          <p className="text-sm text-up">
            Thank you — your Pi arrived. It goes straight into keeping the data feed and the
            daily reports running.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="support-card">
      <CardHeader>
        <CardTitle>Support PiPulse</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed">
          PiPulse is free and stays free. If it is useful to you, you can send the developer
          Pi directly — it pays for the exchange data feed and hosting. It unlocks nothing,
          and nothing here is hidden behind it.
        </p>

        <div className="flex flex-wrap gap-2">
          {options.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setChoice(v)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                choice === v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {v} π
            </button>
          ))}
          <button
            type="button"
            onClick={() => setChoice("custom")}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              choice === "custom"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/50"
            }`}
          >
            Other
          </button>
        </div>

        {choice === "custom" ? (
          <label className="block">
            <span className="text-xs text-muted-foreground">Amount in π</span>
            <input
              inputMode="decimal"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="e.g. 2.5"
              className={`${inputCls} mt-1`}
              data-testid="tip-custom-amount"
            />
          </label>
        ) : null}

        {!data?.user ? (
          <p className="text-xs text-muted-foreground">
            Sign in with Pi first (top right). Payment happens in Pi Browser.
          </p>
        ) : (
          <Button
            disabled={busy || !amountValid}
            data-testid="tip-submit"
            onClick={() => {
              setBusy(true);
              setError(null);
              tipWithPi(amount)
                .then(() => setThanks(true))
                .catch((e: Error) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Waiting for Pi…" : `Send ${amountValid ? amount : ""} π`}
          </Button>
        )}

        {error ? <p className="text-xs text-down">{error}</p> : null}

        <p className="text-[11px] text-muted-foreground">
          Tips are voluntary and non-refundable. They buy no signals, no access and no
          advice.
        </p>
      </CardContent>
    </Card>
  );
}
