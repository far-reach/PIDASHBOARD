"use client";

/**
 * A Card whose body can be collapsed, with the open/closed state remembered
 * per storageKey in localStorage. Defaults to open on first visit: the
 * report is content, not a settings panel that starts hidden.
 *
 * Only the title area toggles: `headerRight` renders as a sibling, not a
 * descendant, of the toggle button, so a link placed there (e.g. "archive")
 * stays a real, independently clickable link instead of nesting one
 * interactive element inside another.
 */
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui";

const LS_PREFIX = "cyberekt:collapsed:";

export function CollapsibleCard({
  storageKey,
  title,
  headerRight,
  children,
}: {
  storageKey: string;
  title: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(LS_PREFIX + storageKey) !== "closed");
    } catch {
      /* storage unavailable: stays open */
    }
  }, [storageKey]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(LS_PREFIX + storageKey, next ? "open" : "closed");
      } catch {
        /* ignore: state just won't persist */
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          data-testid={`${storageKey}-toggle`}
        >
          {title}
          <ChevronDown
            size={16}
            className={
              open
                ? "rotate-180 shrink-0 transition-transform text-muted-foreground"
                : "shrink-0 transition-transform text-muted-foreground"
            }
            aria-hidden
          />
        </button>
        {headerRight ? (
          <span className="inline-flex shrink-0 items-center gap-1.5">{headerRight}</span>
        ) : null}
      </CardHeader>
      {open ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
