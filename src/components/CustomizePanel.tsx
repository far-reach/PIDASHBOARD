"use client";

/**
 * The layout editor: reorder home sections with arrows, hide the ones you do
 * not use, reset to default. Arrows and toggles rather than drag handles:
 * they work identically with a thumb, a mouse and a screen reader, and they
 * need no library.
 */
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  moveSection,
  resetLayout,
  SECTION_LABELS,
  toggleSection,
  useLayoutPrefs,
} from "@/lib/layout-prefs";

export function CustomizePanel({ onClose }: { onClose: () => void }) {
  const prefs = useLayoutPrefs();

  return (
    <Card data-testid="customize-panel">
      <CardHeader>
        <CardTitle>Arrange your dashboard</CardTitle>
        <div className="flex items-center gap-1">
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
          >
            <X size={15} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <p className="text-xs text-muted-foreground pb-1">
          Order and visibility are saved on this device and used every time you come back.
        </p>
        {prefs.order.map((id, i) => {
          const isHidden = prefs.hidden.includes(id);
          return (
            <div
              key={id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <span className={isHidden ? "text-sm text-muted-foreground line-through" : "text-sm"}>
                {SECTION_LABELS[id]}
              </span>
              <span className="flex items-center gap-0.5">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moveSection(id, -1)}
                  title="Move up"
                  aria-label={`Move ${SECTION_LABELS[id]} up`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  disabled={i === prefs.order.length - 1}
                  onClick={() => moveSection(id, 1)}
                  title="Move down"
                  aria-label={`Move ${SECTION_LABELS[id]} down`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleSection(id)}
                  title={isHidden ? "Show this section" : "Hide this section"}
                  aria-label={`${isHidden ? "Show" : "Hide"} ${SECTION_LABELS[id]}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </span>
            </div>
          );
        })}
        <div className="pt-1">
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
