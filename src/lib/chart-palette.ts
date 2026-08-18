/**
 * Chart colors per theme.
 *
 * Deliberately separate from the `--up` / `--down` CSS tokens, which encode
 * signal wins and losses and are pinned to a CVD-validated pair across every
 * theme (see globals.css and COMPLIANCE.md). These are candle colors: a
 * presentation choice for price movement, free to follow the theme's
 * personality, but still required to be a pair with strong hue AND lightness
 * separation so direction stays readable with colour vision deficiency.
 *
 * The Pi theme runs on the network's purple-and-gold branding: gold rises,
 * orchid falls. Both read clearly on the deep purple surface, and they sit
 * 260° apart in hue, so deuteranopia and protanopia still separate them.
 */
export type ChartTheme = "dark" | "light" | "pi";

export interface ChartPalette {
  up: string;
  down: string;
  upVolume: string;
  downVolume: string;
  ink: string;
  grid: string;
  crosshair: string;
  crosshairLabel: string;
  bandLine: string;
  bandEdge: string;
}

const PALETTES: Record<ChartTheme, ChartPalette> = {
  dark: {
    up: "#26a69a",
    down: "#ef5350",
    upVolume: "rgba(38, 166, 154, 0.22)",
    downVolume: "rgba(239, 83, 80, 0.22)",
    ink: "#8b93a3",
    grid: "rgba(139, 147, 163, 0.06)",
    crosshair: "rgba(139, 147, 163, 0.5)",
    crosshairLabel: "#2a2f3a",
    bandLine: "rgba(167, 139, 250, 0.55)",
    bandEdge: "rgba(167, 139, 250, 0.30)",
  },
  light: {
    // Deeper than the dark theme's pair: the same hues washed out on white.
    up: "#0f8b7e",
    down: "#c62d2a",
    upVolume: "rgba(15, 139, 126, 0.28)",
    downVolume: "rgba(198, 45, 42, 0.28)",
    ink: "#5b6472",
    grid: "rgba(91, 100, 114, 0.10)",
    crosshair: "rgba(91, 100, 114, 0.5)",
    crosshairLabel: "#d8dde6",
    bandLine: "rgba(124, 92, 191, 0.55)",
    bandEdge: "rgba(124, 92, 191, 0.30)",
  },
  pi: {
    up: "#f5b942", // Pi gold
    down: "#c264e0", // orchid, 260° away and clearly lighter/darker apart
    upVolume: "rgba(245, 185, 66, 0.22)",
    downVolume: "rgba(194, 100, 224, 0.22)",
    ink: "#a892c4",
    grid: "rgba(168, 146, 196, 0.08)",
    crosshair: "rgba(214, 196, 236, 0.5)",
    crosshairLabel: "#3a2a52",
    bandLine: "rgba(232, 214, 250, 0.5)",
    bandEdge: "rgba(232, 214, 250, 0.26)",
  },
};

export function chartPalette(theme: ChartTheme): ChartPalette {
  return PALETTES[theme];
}
