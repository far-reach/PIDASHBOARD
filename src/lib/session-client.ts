"use client";

/**
 * Client-side session token fallback. The primary session transport is the
 * httpOnly cookie set by /api/pi/verify, but some webviews (notably Pi
 * Browser's iOS WKWebView) drop Set-Cookie headers on fetch responses. The
 * verify endpoint therefore also returns the signed token in its body; it is
 * kept in localStorage and replayed via the x-session-token header, which the
 * server accepts as an equal alternative to the cookie. The token is the same
 * HMAC-signed value either way — storage location is the only difference.
 */

const TOKEN_KEY = "cyberekt:session-token";

export function storeSessionToken(token: string | undefined | null): void {
  if (typeof window === "undefined" || !token) return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage blocked — cookie transport remains the only path */
  }
}

export function clearSessionToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function sessionHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    return token ? { "x-session-token": token } : {};
  } catch {
    return {};
  }
}
