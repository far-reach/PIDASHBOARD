"use client";

/**
 * Per-device home-screen layout: which sections show, and in what order.
 * Stored in localStorage only. No account, no server, nothing to pay for,
 * and the app never learns how anyone arranged their screen.
 *
 * The price hero is deliberately not hideable: an app whose whole point is
 * honest market data should not be configurable into hiding the data.
 */
import { useSyncExternalStore } from "react";

// "support" and "about" were section ids here once; tipping moved to the
// header dialog and the about card to /learn. normalize() silently drops
// retired ids from any saved layout that still carries them, and appends
// newly added ids ("context", "venues") for layouts saved before they
// existed.
export const SECTION_IDS = ["stats", "context", "venues", "chart", "network", "report"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_LABELS: Record<SectionId, string> = {
  stats: "Session stats",
  context: "Today in context",
  venues: "Across venues",
  chart: "Price chart",
  network: "Pi network",
  report: "Daily report",
};

export interface LayoutPrefs {
  order: SectionId[];
  hidden: SectionId[];
}

const KEY = "cyberekt:layout:v1";
const DEFAULTS: LayoutPrefs = { order: [...SECTION_IDS], hidden: [] };

let listeners: (() => void)[] = [];
let cache: { raw: string | null; value: LayoutPrefs } | null = null;

function normalize(input: Partial<LayoutPrefs> | null | undefined): LayoutPrefs {
  const known = new Set<SectionId>(SECTION_IDS);
  const order = (input?.order ?? []).filter((s): s is SectionId => known.has(s as SectionId));
  // Sections added in later versions of the app append at the end instead of
  // vanishing for everyone with a saved layout.
  for (const id of SECTION_IDS) if (!order.includes(id)) order.push(id);
  const hidden = (input?.hidden ?? []).filter((s): s is SectionId => known.has(s as SectionId));
  return { order, hidden };
}

export function getLayoutPrefs(): LayoutPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return DEFAULTS;
  }
  if (cache && cache.raw === raw) return cache.value;
  let value = DEFAULTS;
  if (raw) {
    try {
      value = normalize(JSON.parse(raw) as Partial<LayoutPrefs>);
    } catch {
      value = DEFAULTS;
    }
  }
  cache = { raw, value };
  return value;
}

function save(prefs: LayoutPrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage blocked: the arrangement still applies for this visit.
  }
  cache = null;
  for (const l of listeners) l();
}

export function moveSection(id: SectionId, direction: -1 | 1): void {
  const prefs = getLayoutPrefs();
  const order = [...prefs.order];
  const i = order.indexOf(id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j]!, order[i]!];
  save({ ...prefs, order });
}

export function toggleSection(id: SectionId): void {
  const prefs = getLayoutPrefs();
  const hidden = prefs.hidden.includes(id)
    ? prefs.hidden.filter((h) => h !== id)
    : [...prefs.hidden, id];
  save({ ...prefs, hidden });
}

export function resetLayout(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to reset */
  }
  cache = null;
  for (const l of listeners) l();
}

export function useLayoutPrefs(): LayoutPrefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.push(cb);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
      };
    },
    getLayoutPrefs,
    () => DEFAULTS
  );
}
