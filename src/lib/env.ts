/**
 * Central runtime configuration. Everything defaults to a safe dev value;
 * production values come from platform-managed secrets (never committed).
 */

export const SYMBOL = process.env.NEXT_PUBLIC_SYMBOL ?? "PIUSDT";

export type MonetizationMode = "free" | "freemium";

export function monetizationMode(): MonetizationMode {
  return process.env.MONETIZATION_MODE === "freemium" ? "freemium" : "free";
}

export function adminApiKey(): string {
  return process.env.ADMIN_API_KEY ?? "";
}

export function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-only-insecure-session-secret";
}

export function piApiKey(): string {
  return process.env.PI_API_KEY ?? "";
}

export function piApiBase(): string {
  return process.env.PI_API_BASE ?? "https://api.minepi.com/v2";
}

export function isPiSandbox(): boolean {
  return process.env.NEXT_PUBLIC_PI_SANDBOX !== "false";
}

/** Data considered stale after this many seconds (brief §3.7: badge at >60s). */
export const STALE_AFTER_S = 60;

/** How often the ingest worker polls, ms. */
export const INGEST_INTERVAL_MS = Number(process.env.INGEST_INTERVAL_MS ?? 5000);

/** Snapshot retention window, days. */
export const SNAPSHOT_RETENTION_DAYS = Number(process.env.SNAPSHOT_RETENTION_DAYS ?? 14);

export function reportHourUtc(): number {
  const h = Number(process.env.REPORT_HOUR_UTC ?? 0);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 0;
}
