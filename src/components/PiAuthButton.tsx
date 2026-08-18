"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { useMe } from "@/lib/hooks";
import { signInWithPi } from "@/lib/pi/client";
import { clearSessionToken, sessionHeaders } from "@/lib/session-client";

/**
 * Sign-in entry point. Inside Pi Browser it runs the full Pi auth flow;
 * in a normal browser it explains the graceful fallback (free tier works
 * everywhere; brief §Phase 4.1).
 *
 * Once signed in the username badge becomes the account menu, which is
 * where signing out lives. Signing out clears BOTH transports: the
 * httpOnly cookie server-side, and the localStorage token this app falls
 * back to in webviews that drop Set-Cookie (see lib/session-client). Only
 * clearing one would leave the session alive through the other.
 */
export function PiAuthButton() {
  const { data, refetch } = useMe();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const signOut = useCallback(() => {
    setBusy(true);
    setMenuOpen(false);
    // The header carries the token for webviews without cookies, so the
    // server can clear the right session even when no cookie was sent.
    void fetch("/api/me", { method: "DELETE", headers: sessionHeaders() })
      .catch(() => undefined)
      .finally(() => {
        clearSessionToken();
        void refetch();
        setBusy(false);
      });
  }, [refetch]);

  if (data?.user) {
    const name = data.user.username || data.user.uid.slice(0, 8);
    return (
      <span ref={menuRef} className="relative inline-flex items-center gap-1.5">
        {data.subscription.active ? <Badge tone="up">PRO</Badge> : null}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Account menu for ${name}`}
          disabled={busy}
          data-testid="account-menu-open"
        >
          <Badge tone="primary">@{name}</Badge>
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
          >
            <div className="border-b border-border px-3 py-2">
              <div className="truncate text-xs font-medium">@{name}</div>
              <div className="text-[11px] text-muted-foreground">Signed in with Pi</div>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-card-foreground transition-colors hover:bg-muted"
              data-testid="sign-out"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {notice ? <span className="text-[11px] text-muted-foreground max-w-[200px] break-words">{notice}</span> : null}
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
            .catch((err: unknown) =>
              // The real reason, not a generic retry prompt: a silent failure
              // here is the difference between a fixable report and a dead button.
              setNotice(err instanceof Error ? err.message : "Sign-in didn't complete. Try again.")
            )
            .finally(() => setBusy(false));
        }}
      >
        {busy ? (
          "Connecting…"
        ) : (
          <>
            {/* The header carries four controls on the dashboard; the full
                label only fits once there is room for it. */}
            Sign in<span className="hidden sm:inline"> with Pi</span>
          </>
        )}
      </Button>
    </span>
  );
}
