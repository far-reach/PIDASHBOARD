"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { useMe } from "@/lib/hooks";
import { signInWithPi } from "@/lib/pi/client";

/**
 * Sign-in entry point. Inside Pi Browser it runs the full Pi auth flow;
 * in a normal browser it explains the graceful fallback (free tier works
 * everywhere; brief §Phase 4.1).
 */
export function PiAuthButton() {
  const { data, refetch } = useMe();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (data?.user) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge tone="primary">@{data.user.username || data.user.uid.slice(0, 8)}</Badge>
        {data.subscription.active ? <Badge tone="up">PRO</Badge> : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {notice ? <span className="text-[11px] text-muted-foreground max-w-[160px]">{notice}</span> : null}
      <Button
        variant="outline"
        className="min-h-[32px] py-1 px-2.5 text-xs"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setNotice(null);
          signInWithPi()
            .then((user) => {
              if (user === null) {
                setNotice("Open in Pi Browser to sign in. Browsing works without it.");
              } else {
                void refetch();
              }
            })
            .catch(() => setNotice("Sign-in didn't complete. Try again."))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Connecting…" : "Sign in with Pi"}
      </Button>
    </span>
  );
}
