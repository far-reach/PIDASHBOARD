"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { BarChart3, BookOpen, FileText, Home, Radio } from "lucide-react";
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

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- static
                same-origin SVG; next/image adds nothing for a vector */}
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span className="font-bold text-lg tracking-tight">Cyberekt</span>
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
          <div className="flex items-center gap-2">
            {!online ? <Badge tone="warn">offline</Badge> : null}
            <PiAuthButton />
            <ThemeToggle />
            <TipButton />
          </div>
        </div>
      </header>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur"
        aria-label="Primary"
      >
        <div className={clsx("grid", TABS.length === 5 ? "grid-cols-5" : "grid-cols-3")}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={clsx(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px]",
                  active ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
