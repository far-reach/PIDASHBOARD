/** Shared across every chart surface (embedded card, hero sparkline, overlay). */
export const TF_OPTIONS = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "1h", label: "1h" },
  { value: "1d", label: "1d" },
] as const;

export type Tf = (typeof TF_OPTIONS)[number]["value"];
