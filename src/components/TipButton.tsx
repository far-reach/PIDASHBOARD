"use client";

/**
 * Voluntary tipping, reachable from the header on every screen.
 *
 * Deliberately unlike a paywall: it unlocks nothing, gates nothing, and says
 * so out loud. The amount is chosen here but VERIFIED SERVER-SIDE against the
 * payment as the Pi platform reports it (/api/pi/payments/approve → complete),
 * so nothing on this screen is trusted.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HandCoins, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useMe } from "@/lib/hooks";
import { tipWithPi } from "@/lib/pi/client";

const PRESETS = [0.1, 1, 3.14] as const;

export function TipButton() {
  const { data } = useMe();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<number | "custom">(1);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  const amount = choice === "custom" ? Number(custom) : choice;
  const amountValid = Number.isFinite(amount) && amount > 0;

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setError(null);
    setThanks(false);
  }, [busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        aria-label="Tip the developer"
        data-testid="tip-open"
      >
        <HandCoins size={15} />
        <span className="hidden sm:inline">Tip</span>
      </button>

      {/* Portaled to <body>: the sticky header's backdrop-filter makes it the
          containing block for fixed descendants, which would pin this overlay
          inside the 64px header instead of the viewport. */}
      {open && typeof document !== "undefined" ? (
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tip-dialog-title"
          data-testid="tip-dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="tip-dialog-title" className="text-base font-semibold">
                Support Cyberekt
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {thanks ? (
              <p className="mt-4 text-sm text-up" data-testid="support-thanks">
                Thank you. Your Pi arrived, and it goes straight into keeping the data feed
                and the daily reports running.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Cyberekt is free and stays free. Tips pay for the exchange data feed and
                  hosting. They unlock nothing, and nothing here is hidden behind them.
                </p>

                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((v) => (
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
                    Custom
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
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      data-testid="tip-custom-amount"
                    />
                  </label>
                ) : null}

                {!data?.user ? (
                  <p className="text-xs text-muted-foreground">
                    Sign in with Pi first (header button). Payment happens in Pi Browser.
                  </p>
                ) : (
                  <Button
                    className="w-full"
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
                  Tips are voluntary and non-refundable. They buy no signals, no access and
                  no advice.
                </p>
              </div>
            )}
          </div>
        </div>,
        document.body
        )
      ) : null}
    </>
  );
}
