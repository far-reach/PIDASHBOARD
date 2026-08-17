"use client";

/**
 * Theme state: dark (default), light, or follow the device. The chosen value
 * lives in localStorage; an inline script in the document head applies it
 * before first paint so there is no flash. This module is the runtime side:
 * a tiny external store components subscribe to, so a change in one place
 * (the nav toggle) restyles everything, charts included.
 */
import { useSyncExternalStore } from "react";

export type ThemePref = "dark" | "light" | "system";

export const THEME_KEY = "cyberekt:theme";

let listeners: (() => void)[] = [];

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "dark";
  const raw = window.localStorage.getItem(THEME_KEY);
  return raw === "light" || raw === "system" ? raw : "dark";
}

/** The theme actually in effect after resolving "system". */
export function resolvedTheme(pref: ThemePref = getThemePref()): "dark" | "light" {
  if (pref === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return pref;
}

export function applyTheme(pref: ThemePref): void {
  const target = resolvedTheme(pref);
  document.documentElement.classList.toggle("light", target === "light");
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
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const onMq = () => {
        if (getThemePref() === "system") {
          applyTheme("system");
          cb();
        }
      };
      mq.addEventListener("change", onMq);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
        mq.removeEventListener("change", onMq);
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
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var l=t==="light"||(t==="system"&&matchMedia("(prefers-color-scheme: light)").matches);if(l)document.documentElement.classList.add("light")}catch(e){}`;
