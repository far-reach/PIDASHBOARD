"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { BarChart3, BookOpen, FileText, Home, Radio } from "lucide-react";
import { PiAuthButton } from "@/components/PiAuthButton";
import { useOnline } from "@/lib/hooks";
import { Badge } from "@/components/ui";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/signals", label: "Signals", icon: Radio },
  { href: "/performance", label: "Performance", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/learn", label: "Learn", icon: BookOpen },
] as const;

/** Top bar (identity + auth) and, on mobile, a bottom tab bar — Pi Browser is mobile-first. */
export function Nav() {
  const pathname = usePathname();
  const online = useOnline();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 h-12 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary text-sm font-bold">
              π
            </span>
            <span className="font-semibold tracking-tight">PiPulse</span>
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
          </div>
        </div>
      </header>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur"
        aria-label="Primary"
      >
        <div className="grid grid-cols-5">
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
