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

/**
 * Signing key for session cookies. A hardcoded fallback would let anyone who
 * has read this open-source repo forge a session on a deployment that forgot
 * to set the variable, so production refuses to sign with a known key.
 */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.startsWith("change-me")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET is not set (or is still the placeholder). Refusing to sign sessions " +
          "with a publicly-known key. Generate one with: openssl rand -hex 32"
      );
    }
    return "dev-only-insecure-session-secret";
  }
  return secret;
}

/** Price of the 30-day Pro subscription, in Pi. */
export function proPricePi(): number {
  const n = Number(process.env.PRO_PRICE_PI ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
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
