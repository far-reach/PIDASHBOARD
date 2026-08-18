"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: true, retry: 1 },
        },
      })
  );

  // Register the offline service worker (PWA; brief §Phase 2.7).
  // updateViaCache "none" plus an update() whenever the app regains focus
  // makes a new deploy's worker install promptly; without it the browser may
  // sit on the old worker for up to a day, which read as "the fix never
  // shipped" on real phones.
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          const check = () => {
            if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
          };
          document.addEventListener("visibilitychange", check);
        })
        .catch(() => {
          /* offline support is best-effort */
        });
    }
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
