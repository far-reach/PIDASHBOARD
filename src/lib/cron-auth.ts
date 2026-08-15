import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { adminApiKey } from "@/lib/env";

/**
 * Authorizes scheduled-job endpoints. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; the operator API key is accepted too
 * so the endpoints can be triggered manually during setup.
 *
 * Fails closed: with neither CRON_SECRET nor ADMIN_API_KEY configured, no
 * request is ever authorized.
 */
export function isCronRequest(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;

  const accepted = [process.env.CRON_SECRET, adminApiKey()].filter(
    (s): s is string => !!s && s.length >= 16 && !s.startsWith("change-me")
  );
  return accepted.some((secret) => {
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
