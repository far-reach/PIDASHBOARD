"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "cyberekt:risk-banner";

/**
 * First-visit risk disclosure (brief §Phase 2.5), shown once per session as a
 * dialog the user acknowledges rather than a persistent strip. Acknowledging
 * is a stronger disclosure than merely displaying, and it costs no layout
 * space afterwards. Footer disclaimers remain on every screen regardless, and
 * the full text stays available at /legal/risk.
 */
export function RiskBanner() {
  // Starts dismissed so the server and first client render agree; the real
  // value is read from sessionStorage on mount.
  const [dismissed, setDismissed] = useState(true);
  const acknowledgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(STORAGE_KEY) === "dismissed");
  }, []);

  const acknowledge = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, "dismissed");
    setDismissed(true);
  }, []);

  // Focus the acknowledge button on open and close on Escape, so the
  // disclosure is operable without a pointer. The page behind must not
  // scroll while the dialog is up.
  useEffect(() => {
    if (dismissed) return;
    acknowledgeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") acknowledge();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [dismissed, acknowledge]);

  if (dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-dialog-title"
      data-testid="risk-banner"
    >
      <div className="w-full max-w-md rounded-2xl border border-warn/30 bg-card p-5 shadow-2xl">
        <h2 id="risk-dialog-title" className="text-base font-semibold text-warn">
          Before you continue
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-card-foreground">
          Educational information only; not financial advice. Crypto markets are volatile and you
          can lose what you commit. Prices are reported by third-party exchanges and may be delayed.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Cyberekt reports observed market data. It publishes no forecasts, no valuation claims and
          no recommendations, and is an independent community app, not affiliated with or endorsed
          by the Pi Core Team.
        </p>
        <button
          ref={acknowledgeRef}
          aria-label="Dismiss risk banner for this session"
          className="mt-5 w-full rounded-xl border border-warn/40 bg-warn/15 px-4 py-3 text-sm font-medium text-warn transition-colors hover:bg-warn/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-warn/60"
          onClick={acknowledge}
        >
          I understand
        </button>
      </div>
    </div>
  );
}
