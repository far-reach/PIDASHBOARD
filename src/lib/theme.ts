"use client";

/**
 * Theme state: dark (default), light, or "pi" — a Pi-ecosystem look built on
 * the network's purple-and-gold branding. The chosen value lives in
 * localStorage; an inline script in the document head applies it before first
 * paint so there is no flash. This module is the runtime side: a tiny
 * external store components subscribe to, so a change in one place (the nav
 * toggle) restyles everything, charts included.
 *
 * A legacy stored value of "system" (from the retired follow-the-device
 * option) falls back to dark.
 */
import { useSyncExternalStore } from "react";

export type ThemePref = "dark" | "light" | "pi";

export const THEME_KEY = "cyberekt:theme";

let listeners: (() => void)[] = [];

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "dark";
  const raw = window.localStorage.getItem(THEME_KEY);
  return raw === "light" || raw === "pi" ? raw : "dark";
}

/**
 * The dark/light base a theme renders on, for consumers that need a binary
 * (chart styling). The pi theme is dark-based.
 */
export function resolvedTheme(pref: ThemePref = getThemePref()): "dark" | "light" {
  return pref === "light" ? "light" : "dark";
}

export function applyTheme(pref: ThemePref): void {
  document.documentElement.classList.toggle("light", pref === "light");
  document.documentElement.classList.toggle("pi", pref === "pi");
}

export function setThemePref(pref: ThemePref): void {
  try {
    window.localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Storage blocked: the choice still applies for this visit.
  }
  applyTheme(pref);
  for (const l of listeners) l();
}

export function useTheme(): { pref: ThemePref; resolved: "dark" | "light" } {
  const pref = useSyncExternalStore(
    (cb) => {
      listeners.push(cb);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
      };
    },
    getThemePref,
    () => "dark" as const
  );
  return { pref, resolved: resolvedTheme(pref) };
}

/**
 * Runs before first paint, inlined in the document head. Kept here so the
 * layout imports a constant instead of embedding a string nobody re-reads.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY
)});var c=document.documentElement.classList;if(t==="light")c.add("light");else if(t==="pi")c.add("pi")}catch(e){}`;
