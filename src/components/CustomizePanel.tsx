"use client";

/**
 * The layout editor: reorder home sections with arrows, hide the ones you do
 * not use, reset to default. Arrows and toggles rather than drag handles:
 * they work identically with a thumb, a mouse and a screen reader, and they
 * need no library.
 *
 * It floats over the LEFT of the page rather than replacing the dashboard,
 * and deliberately has NO backdrop: the strip of page to its right stays
 * scrollable and tappable, so the reader can move down the dashboard and
 * watch sections appear, disappear and reorder live while deciding. The
 * panel scrolls internally if the list outgrows the viewport.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, X } from "lucide-react";
import {
  moveSection,
  resetLayout,
  SECTION_LABELS,
  toggleSection,
  useLayoutPrefs,
} from "@/lib/layout-prefs";

export function CustomizePanel({ onClose }: { onClose: () => void }) {
  const prefs = useLayoutPrefs();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // Body scroll is intentionally NOT locked: scrolling the page while the
    // panel is open is the whole point of this layout.
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    /* Hugs its content and caps at 62vh rather than stretching to the
       bottom: everything below stays full-width and visible, so changes can
       be watched happening while the panel is open. */
    <aside
      className="fixed left-2 top-[4.5rem] z-40 flex max-h-[62vh] w-[64vw] max-w-[270px] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-2xl backdrop-blur md:w-72"
      role="dialog"
      aria-label="Arrange your dashboard"
      data-testid="customize-panel"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-xs font-bold uppercase tracking-wide">Arrange</h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={resetLayout}
            title="Reset to the default arrangement"
            aria-label="Reset to the default arrangement"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close the layout editor"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            data-testid="customize-close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2.5 py-2">
        <p className="pb-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Scroll the page beside this panel to watch changes as you make them. Saved on this
          device.
        </p>
        {prefs.order.map((id, i) => {
          const isHidden = prefs.hidden.includes(id);
          return (
            <div
              key={id}
              className="flex items-center justify-between gap-1 rounded-md border border-border px-2 py-1.5"
            >
              <span
                className={
                  isHidden
                    ? "min-w-0 truncate text-xs text-muted-foreground line-through"
                    : "min-w-0 truncate text-xs"
                }
              >
                {SECTION_LABELS[id]}
              </span>
              <span className="flex shrink-0 items-center">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moveSection(id, -1)}
                  title="Move up"
                  aria-label={`Move ${SECTION_LABELS[id]} up`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={i === prefs.order.length - 1}
                  onClick={() => moveSection(id, 1)}
                  title="Move down"
                  aria-label={`Move ${SECTION_LABELS[id]} down`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleSection(id)}
                  title={isHidden ? "Show this section" : "Hide this section"}
                  aria-label={`${isHidden ? "Show" : "Hide"} ${SECTION_LABELS[id]}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </aside>,
    document.body
  );
}
