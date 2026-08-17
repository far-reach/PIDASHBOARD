"use client";

/**
 * Section jumper for the Learn page: a compact menu in the top-right corner
 * that scrolls to any subject. Client-side only for the smooth scroll; the
 * content itself stays server-rendered.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export function LearnSectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        data-testid="learn-section-nav"
      >
        Sections
        <ChevronDown size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2.5 text-left text-sm text-card-foreground transition-colors hover:bg-muted"
              onClick={() => {
                setOpen(false);
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
