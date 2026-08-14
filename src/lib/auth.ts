/**
 * Request authentication helpers. Two principals exist:
 *   - the operator (ADMIN_API_KEY bearer token) — may publish signals and
 *     append manual-close events; nothing grants edit/delete, which do not exist
 *   - a Pi user (signed session cookie) — may hold a subscription
 * Every protected check happens server-side (brief §Phase 4 exit criteria).
 */
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { adminApiKey, monetizationMode } from "@/lib/env";
import { getDb, toIso } from "@/lib/db";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export function isAdminRequest(req: NextRequest): boolean {
  const configured = adminApiKey();
  if (!configured || configured.startsWith("change-me")) {
    // An unset/placeholder key never authenticates in production.
    if (process.env.NODE_ENV === "production") return false;
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !configured) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(configured);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface SessionUser {
  uid: string;
  username: string;
}

export function getSessionUser(req: NextRequest): SessionUser | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  return payload ? { uid: payload.uid, username: payload.username } : null;
}

export interface SubscriptionStatus {
  active: boolean;
  plan: string | null;
  expiresAt: string | null;
}

export async function getSubscription(uid: string): Promise<SubscriptionStatus> {
  const db = await getDb();
  const { rows } = await db.query<{ plan: string; expires_at: unknown }>(
    `SELECT plan, expires_at FROM subscriptions
     WHERE pi_user_id = $1 AND status = 'active' AND expires_at > now()
     ORDER BY expires_at DESC LIMIT 1`,
    [uid]
  );
  const row = rows[0];
  if (!row) return { active: false, plan: null, expiresAt: null };
  return { active: true, plan: row.plan, expiresAt: toIso(row.expires_at) };
}

/**
 * Gate for currently-open signals (MONETIZATION.md): in "free" mode everyone
 * sees them; in "freemium" mode the operator and active subscribers do.
 * Closed signals and full performance history are never gated (brief §3.8).
 */
export async function canSeeOpenSignals(req: NextRequest): Promise<boolean> {
  if (monetizationMode() === "free") return true;
  if (isAdminRequest(req)) return true;
  const user = getSessionUser(req);
  if (!user) return false;
  const sub = await getSubscription(user.uid);
  return sub.active;
}
