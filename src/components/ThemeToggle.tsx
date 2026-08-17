"use client";

/**
 * Cycles dark, light, Pi-branded. One small button rather than a settings
 * screen: mobile users get their preference in taps and it sticks
 * (localStorage, applied before first paint by the head script).
 */
import { Moon, Sun } from "lucide-react";
import { setThemePref, useTheme, type ThemePref } from "@/lib/theme";

const NEXT: Record<ThemePref, ThemePref> = { dark: "light", light: "pi", pi: "dark" };
const LABEL: Record<ThemePref, string> = {
  dark: "Dark theme. Tap for light",
  light: "Light theme. Tap for the Pi theme",
  pi: "Pi theme. Tap for dark",
};

export function ThemeToggle() {
  const { pref } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setThemePref(NEXT[pref])}
      title={LABEL[pref]}
      aria-label={LABEL[pref]}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
      data-testid="theme-toggle"
    >
      {pref === "dark" ? (
        <Moon size={15} />
      ) : pref === "light" ? (
        <Sun size={15} />
      ) : (
        <span className="text-sm font-bold leading-none text-primary">π</span>
      )}
    </button>
  );
}
