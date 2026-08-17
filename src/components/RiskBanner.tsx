"use client";

import { useEffect, useState } from "react";

/** Session-dismissible risk banner (brief §Phase 2.5). Footer disclaimers stay regardless. */
export function RiskBanner() {
  const [dismissed, setDismissed] = useState(true); // avoid SSR flash; resolve on mount

  useEffect(() => {
    setDismissed(sessionStorage.getItem("cyberekt:risk-banner") === "dismissed");
  }, []);

  if (dismissed) return null;

  return (
    <div
      className="bg-warn/10 border-b border-warn/30 px-4 py-2 flex items-start justify-between gap-3"
      role="alert"
      data-testid="risk-banner"
    >
      <p className="text-xs text-warn leading-relaxed">
        Educational information only; not financial advice. Crypto markets are volatile and you
        can lose what you commit. Prices are reported by third-party exchanges and may be delayed.
      </p>
      <button
        aria-label="Dismiss risk banner for this session"
        className="text-warn/80 hover:text-warn text-lg leading-none px-1"
        onClick={() => {
          sessionStorage.setItem("cyberekt:risk-banner", "dismissed");
          setDismissed(true);
        }}
      >
        ×
      </button>
    </div>
  );
}
