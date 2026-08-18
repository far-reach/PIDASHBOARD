"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { BarChart3, BookOpen, FileText, Home, Radio, SlidersHorizontal } from "lucide-react";
import { CustomizePanel } from "@/components/CustomizePanel";
import { PiAuthButton } from "@/components/PiAuthButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TipButton } from "@/components/TipButton";
import { useOnline } from "@/lib/hooks";
import { Badge } from "@/components/ui";
import { SIGNALS_ENABLED } from "@/lib/env";

const BASE_TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/learn", label: "Learn", icon: BookOpen },
] as const;

/**
 * The directional-call surfaces. Off by default: an app in the Pi ecosystem
 * publishing entry/stop/target calls is making material representations about
 * the valuation of Pi, which the ecosystem guidelines prohibit. See
 * COMPLIANCE.md; do not re-enable without a written answer from Pi.
 */
const SIGNAL_TABS = [
  { href: "/signals", label: "Signals", icon: Radio },
  { href: "/performance", label: "Performance", icon: BarChart3 },
] as const;

const TABS = SIGNALS_ENABLED ? [BASE_TABS[0], ...SIGNAL_TABS, ...BASE_TABS.slice(1)] : BASE_TABS;

/** Top bar (identity + auth) and, on mobile, a bottom tab bar; Pi Browser is mobile-first. */
export function Nav() {
  const pathname = usePathname();
  const online = useOnline();
  // Arranging only means anything on the dashboard, so the control appears
  // there and nowhere else. The header owns the state because the panel is
  // portaled to the body anyway and needs no page context.
  const [arranging, setArranging] = useState(false);
  const onDashboard = pathname === "/";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-2">
          <Link href="/" className="flex min-w-0 shrink items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- static
                same-origin SVG; next/image adds nothing for a vector */}
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span className="truncate font-bold text-lg tracking-tight">Cyberekt</span>
            <span className="text-[11px] text-muted-foreground hidden sm:inline">PIUSDT dashboard</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={clsx(
                  "px-2.5 py-1.5 rounded-md text-sm",
                  pathname === t.href
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {/* Ordered outward from "how this page looks" to "who I am":
              arrange and theme shape the view, tipping and identity are
              personal, and sign-in keeps the far-right anchor slot. */}
          <div className="flex shrink-0 items-center gap-1.5">
            {!online ? <Badge tone="warn">offline</Badge> : null}
            {onDashboard ? (
              <button
                type="button"
                onClick={() => setArranging(true)}
                aria-label="Arrange dashboard sections"
                title="Arrange dashboard"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                data-testid="customize-open"
              >
                <SlidersHorizontal size={15} />
              </button>
            ) : null}
            <ThemeToggle />
            <TipButton />
            <PiAuthButton />
          </div>
        </div>
      </header>

      {arranging ? <CustomizePanel onClose={() => setArranging(false)} /> : null}

      {/* The bottom bar sits above the iPhone home indicator via the safe-area
          inset, and marks the current tab with a tinted pill plus a short
          accent rule rather than colour alone. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Primary"
      >
        <div className={clsx("grid px-2 py-1.5", TABS.length === 5 ? "grid-cols-5" : "grid-cols-3")}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className="group relative flex flex-col items-center gap-1 rounded-xl px-1 py-1.5"
              >
                <span
                  aria-hidden
                  className={clsx(
                    "pointer-events-none absolute inset-x-2 inset-y-0 rounded-xl transition-colors",
                    active ? "bg-primary/10" : "group-active:bg-muted/60"
                  )}
                />
                <span
                  aria-hidden
                  className={clsx(
                    "pointer-events-none absolute -top-[7px] h-[2px] rounded-full bg-primary transition-all",
                    active ? "w-7 opacity-100" : "w-0 opacity-0"
                  )}
                />
                <Icon
                  size={18}
                  strokeWidth={active ? 2.4 : 1.9}
                  className={clsx(
                    "relative transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span
                  className={clsx(
                    "relative text-[10px] tracking-wide transition-colors",
                    active ? "font-semibold text-primary" : "text-muted-foreground"
                  )}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
